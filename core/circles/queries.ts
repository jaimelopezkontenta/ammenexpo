import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

export type CircleVisibility = "private" | "public";

export type Circle = {
  id: string;
  name: string;
  description: string | null;
  visibility: CircleVisibility;
  member_count: number;
  owner_id: string;
  streak_count: number;
};

export type CircleMember = {
  user_id: string;
  role: "owner" | "admin" | "member";
  display_name: string;
  avatar_url: string | null;
};

// `invite_token` is deliberately absent. The SELECT policy lets anyone read
// any *public* circle, so a table-wide read handed out the invite token of
// every public circle in the directory. It now comes from
// `circle_invite_token()`, which requires membership.
const CIRCLE_COLUMNS =
  "id, name, description, visibility, member_count, owner_id, streak_count";

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

export type PublicCircle = {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  is_member: boolean;
  total_count: number;
};

/**
 * The directory `circulos.tsx` has been promising since the first screen:
 * "aparecerá en las búsquedas".
 *
 * An empty query browses instead of filtering — searching and getting nothing
 * reads as "there are none", which is a different and wrong answer.
 */
export const useSearchPublicCircles = (query: string) =>
  useQuery({
    queryKey: ["publicCircles", query],
    queryFn: async (): Promise<PublicCircle[]> => {
      const { data, error } = await supabase.rpc("search_public_circles", {
        p_query: query,
      });

      if (error) throw error;

      return (data ?? []) as PublicCircle[];
    },
  });

/** Joining a public circle needs no token: the INSERT policy allows it. */
export const useJoinPublicCircle = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (circleId: string) => {
      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: circleId, user_id: userId! });

      if (error) throw error;
    },
    onSuccess: (_result, circleId) => {
      void queryClient.invalidateQueries({ queryKey: ["circles", userId] });
      void queryClient.invalidateQueries({
        queryKey: ["sharedWithMe", userId],
      });
      void queryClient.invalidateQueries({ queryKey: ["publicCircles"] });
      void queryClient.invalidateQueries({ queryKey: ["circle", circleId] });
    },
  });
};

/** The invite token, which no longer travels with the circle row. */
export const useCircleInviteToken = (circleId: string | undefined) =>
  useQuery({
    queryKey: ["circleInviteToken", circleId],
    enabled: Boolean(circleId),
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("circle_invite_token", {
        p_group_id: circleId!,
      });

      if (error) throw error;

      return (data as string | null) ?? null;
    },
  });

/**
 * Removing somebody from a circle.
 *
 * A trigger refuses to remove the owner, so this can fail for a reason the
 * screen has to show rather than swallow — an admin who thinks they removed
 * someone who is still in the room is the worst possible outcome here.
 */
export const useRemoveMember = (circleId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { data, error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", circleId!)
        .eq("user_id", memberId)
        .select("user_id");

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("remove_member_no_rows");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["circleMembers", circleId],
      });
      void queryClient.invalidateQueries({ queryKey: ["circle", circleId] });
    },
  });
};

export type CirclePlan = {
  plan_id: string;
  title: string;
  theme: string | null;
  duration_days: number;
  status: string;
  day_id: string | null;
  day_number: number | null;
  day_title: string | null;
  prayed_today: boolean;
  prayed_count: number;
};

/**
 * The circle's own plan: one walk everybody reads, rather than a personal plan
 * shared outward.
 *
 * `prayer_plans.group_id` has carried the policies for this since the first
 * migration with nothing ever writing it, and `groups.streak_count` has read
 * zero for just as long.
 */
export const useCirclePlan = (circleId: string | undefined) =>
  useQuery({
    queryKey: ["circlePlan", circleId],
    enabled: Boolean(circleId),
    queryFn: async (): Promise<CirclePlan | null> => {
      const { data, error } = await supabase.rpc("circle_plan", {
        p_group_id: circleId!,
      });

      if (error) throw error;

      return ((data ?? []) as CirclePlan[])[0] ?? null;
    },
    refetchInterval: (query) =>
      query.state.data?.status === "generating" ? 3000 : false,
  });

/** Whether this person may start the circle's plan: admin, and none running. */
export const useCanCreateCirclePlan = (circleId: string | undefined) =>
  useQuery({
    queryKey: ["canCreateCirclePlan", circleId],
    enabled: Boolean(circleId),
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("can_create_circle_plan", {
        p_group_id: circleId!,
      });

      if (error) throw error;

      return data === true;
    },
  });

/**
 * One tap, two records: the personal log that moves your own streak, and the
 * circle's record that everybody else can read. `prayer_logs` is readable only
 * by its owner, so a "who in the circle prayed today" count cannot hang off it.
 */
export const useMarkCircleDay = (
  circleId: string | undefined,
  userId: string | undefined,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planDayId: string) => {
      const { data, error } = await supabase.rpc("mark_circle_day", {
        p_plan_day_id: planDayId,
      });

      if (error) throw error;

      // The RPC answers false rather than raising when the day is locked or you
      // are no longer in the circle, so ignoring the payload would show a
      // success on a write that did nothing.
      if (data !== true) {
        throw new Error("mark_circle_day_refused");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["circlePlan", circleId],
      });
      void queryClient.invalidateQueries({ queryKey: ["circle", circleId] });
      // It counts as praying, so the personal streak moved too.
      void queryClient.invalidateQueries({ queryKey: ["streak", userId] });
    },
  });
};
