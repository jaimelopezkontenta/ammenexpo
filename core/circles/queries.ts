import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

export type CircleVisibility = "private" | "public";

export type Circle = {
  id: string;
  name: string;
  description: string | null;
  visibility: CircleVisibility;
  invite_token: string;
  member_count: number;
  owner_id: string;
};

export type CircleMember = {
  user_id: string;
  role: "owner" | "admin" | "member";
  display_name: string;
  avatar_url: string | null;
};

const CIRCLE_COLUMNS =
  "id, name, description, visibility, invite_token, member_count, owner_id";

/** RLS returns only circles the caller belongs to (plus public ones). */
export const useMyCircles = (userId: string | undefined) =>
  useQuery({
    queryKey: ["circles", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Circle[]> => {
      const { data, error } = await supabase
        .from("group_members")
        .select(`groups!inner(${CIRCLE_COLUMNS})`)
        .eq("user_id", userId!);

      if (error) throw error;

      return (data ?? []).flatMap(
        (row) => (row as unknown as { groups: Circle }).groups ?? [],
      );
    },
  });

export const useCircle = (circleId: string | undefined) =>
  useQuery({
    queryKey: ["circle", circleId],
    enabled: Boolean(circleId),
    queryFn: async (): Promise<Circle | null> => {
      const { data, error } = await supabase
        .from("groups")
        .select(CIRCLE_COLUMNS)
        .eq("id", circleId!)
        .maybeSingle();

      if (error) throw error;

      return data as Circle | null;
    },
  });

export const useCircleMembers = (circleId: string | undefined) =>
  useQuery({
    queryKey: ["circleMembers", circleId],
    enabled: Boolean(circleId),
    queryFn: async (): Promise<CircleMember[]> => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id, role, profiles!inner(display_name, avatar_url)")
        .eq("group_id", circleId!);

      if (error) throw error;

      return (data ?? []).map((row) => {
        const entry = row as unknown as {
          user_id: string;
          role: CircleMember["role"];
          profiles: { display_name: string; avatar_url: string | null };
        };

        return {
          user_id: entry.user_id,
          role: entry.role,
          display_name: entry.profiles?.display_name ?? "",
          avatar_url: entry.profiles?.avatar_url ?? null,
        };
      });
    },
  });

export const useCreateCircle = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      visibility: CircleVisibility;
    }): Promise<Circle> => {
      const { data, error } = await supabase
        .from("groups")
        .insert({
          owner_id: userId!,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          visibility: input.visibility,
        })
        .select(CIRCLE_COLUMNS)
        .single();

      if (error) throw error;

      return data as Circle;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["circles", userId] });
    },
  });
};

/** Reads an invite before the visitor has an account. */
export const useCircleInvitePreview = (token: string | undefined) =>
  useQuery({
    queryKey: ["circleInvite", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_circle_invite_preview", {
        p_token: token,
      });

      if (error) throw error;

      return (
        (
          data as
            | {
                circle_id: string;
                name: string;
                description: string | null;
                member_count: number;
              }[]
            | null
        )?.[0] ?? null
      );
    },
  });

export const useJoinCircle = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await supabase.rpc("join_group_with_token", {
        token,
      });

      if (error) throw error;

      return data as string;
    },
    onSuccess: (circleId) => {
      // Joining a circle is *how* other people's plans become visible to you,
      // so refreshing only the circle list left the Orar tab insisting nobody
      // had shared anything — with a button sending you back to circles. That
      // dead end was the end of the acquisition loop.
      void queryClient.invalidateQueries({ queryKey: ["circles", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["sharedWithMe", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["circle", circleId] });
      void queryClient.invalidateQueries({
        queryKey: ["circleMembers", circleId],
      });
    },
  });
};

export const useLeaveCircle = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (circleId: string) => {
      const { data, error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", circleId)
        .eq("user_id", userId!)
        .select("user_id");

      if (error) throw error;

      // A delete that RLS filtered to nothing comes back as success with no
      // rows. Without this the app would say you left and leave you in.
      if (!data || data.length === 0) {
        throw new Error("leave_circle_no_rows");
      }
    },
    onSuccess: (_result, circleId) => {
      // The mirror of joining: those plans are no longer readable, so leaving
      // them listed would show a live "Oré por ti" that fails on tap.
      void queryClient.invalidateQueries({ queryKey: ["circles", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["sharedWithMe", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["circle", circleId] });
      void queryClient.invalidateQueries({
        queryKey: ["circleMembers", circleId],
      });
    },
  });
};
