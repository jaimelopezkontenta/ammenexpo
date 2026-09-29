import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PAGE_SIZE, rowId, usePagedQuery } from "@/core/paging";
import { supabase } from "@/utils/supabase";

import { qk } from "@/core/query/keys";
export const TESTIMONY_MAX = 2000;

export type TestimonyVisibility = "private" | "circles" | "public";

export type Testimony = {
  id: string;
  body: string;
  visibility: TestimonyVisibility;
  created_at: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  plan_title: string | null;
  is_mine: boolean;
};

/**
 * The fourth loop, and the only one that had never been built.
 *
 * `testimonies` has carried RLS, policies and grants since the first migration
 * with nothing reading or writing it. It is the most shareable moment the
 * product has — you pray for thirty days about your mother's illness and there
 * was nowhere to say that it happened.
 *
 * Which ones come back is decided entirely by the policy: yours always,
 * everyone else's only if they chose to share and you have not blocked them.
 */
export const useVisibleTestimonies = (userId: string | undefined) =>
  usePagedQuery<Testimony>({
    queryKey: qk.testimonies(userId),
    enabled: Boolean(userId),
    keyOf: rowId,
    fetchPage: async (cursor) => {
      const { data, error } = await supabase.rpc("visible_testimonies_page", {
        p_before: cursor?.created_at,
        p_before_id: cursor?.id,
        p_limit: PAGE_SIZE,
      });

      if (error) throw error;

      return (data ?? []) as Testimony[];
    },
  });

export const useWriteTestimony = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      body: string;
      visibility: TestimonyVisibility;
      planId?: string;
      /** Una petición de la lista responde igual que un plan de treinta días. */
      listItemId?: string;
    }) => {
      const { error } = await supabase.from("testimonies").insert({
        user_id: userId!,
        body: input.body.trim().slice(0, TESTIMONY_MAX),
        visibility: input.visibility,
        plan_id: input.planId ?? null,
        list_item_id: input.listItemId ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.testimonies(userId) });
    },
  });
};

/**
 * Changing your mind afterwards.
 *
 * Whoever wrote it is the only person who can, and going back to `private` has
 * to work — somebody who shared and regretted it needs the door, not a support
 * email.
 */
export const useSetTestimonyVisibility = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      visibility: TestimonyVisibility;
    }) => {
      const { data, error } = await supabase
        .from("testimonies")
        .update({ visibility: input.visibility })
        .eq("id", input.id)
        .select("id");

      if (error) throw error;

      // A row count of zero is how RLS refuses an update: no error, no rows.
      if (!data?.length) throw new Error("testimony_update_no_rows");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.testimonies(userId) });
    },
  });
};

export const useDeleteTestimony = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("testimonies")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) throw error;

      if (!data?.length) throw new Error("testimony_delete_no_rows");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.testimonies(userId) });
    },
  });
};

/** Same surface as every other piece of text one person writes for another. */
export const useReportTestimony = (userId: string | undefined) =>
  useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reports").insert({
        reporter_id: userId!,
        target_type: "testimony",
        target_id: id,
      });

      if (error) throw error;
    },
  });
