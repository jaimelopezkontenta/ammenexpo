import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/utils/supabase";

const SHARE_KEY = "ammen.pendingShareToken";
const INVITE_KEY = "ammen.pendingInviteCode";

/**
 * Someone who opens a shared plan on the web has no account yet, so the token
 * that brought them here has to survive signup. We stash it locally, then move
 * it onto their profile the moment an account exists; `complete_onboarding()`
 * redeems it server-side.
 *
 * Losing the token here means the acquisition loop still *looks* like it works
 * while quietly dropping every new user on the floor.
 */

export const rememberShareToken = async (token: string) => {
  try {
    await AsyncStorage.setItem(SHARE_KEY, token);
  } catch {
    // Best effort: a blocked storage should not break the preview page.
  }
};

export const rememberInviteCode = async (code: string) => {
  try {
    await AsyncStorage.setItem(INVITE_KEY, code);
  } catch {
    // See above.
  }
};

export const readPendingTokens = async () => {
  try {
    const [shareToken, inviteCode] = await Promise.all([
      AsyncStorage.getItem(SHARE_KEY),
      AsyncStorage.getItem(INVITE_KEY),
    ]);

    return { shareToken, inviteCode };
  } catch {
    return { shareToken: null, inviteCode: null };
  }
};

export const clearPendingTokens = async () => {
  try {
    await AsyncStorage.multiRemove([SHARE_KEY, INVITE_KEY]);
  } catch {
    // Nothing actionable; the server clears its copy on redeem anyway.
  }
};

/**
 * Redeems whatever is stashed locally, for whoever is signed in right now.
 *
 * The chain used to have exactly one link, and it broke in two common cases.
 * `complete_onboarding()` redeems `profile_settings.pending_share_token`, and
 * that column is only ever written by `attachPendingTokensToProfile`, which
 * `crear-cuenta.tsx` only calls when sign-up returns a session. With email
 * confirmation turned on it does not: the person confirms, comes back, signs in
 * through `entrar.tsx` — which never touched any of this — and onboarding finds
 * nothing. And someone who already had an account never went through onboarding
 * at all, so their token sat in storage and was never read again.
 *
 * Both meant the invitation vanished without a word and the new arrival landed
 * on "Aún no tienes un plan", one tab away from the person they came for.
 *
 * Running on every sign-in costs nothing once there is nothing left to redeem,
 * and the RPCs are idempotent (`on conflict do nothing`).
 */
export const redeemPendingTokens = async () => {
  const { shareToken, inviteCode } = await readPendingTokens();

  if (!shareToken && !inviteCode) {
    return null;
  }

  let planId: string | null = null;

  if (shareToken) {
    const { data, error } = await supabase.rpc("redeem_share_token", {
      p_token: shareToken,
    });

    // A revoked or expired token answers `{ok:false}` *without* raising, and
    // retrying it every launch forever would be pointless. A network failure
    // does raise, and that one is worth keeping for next time.
    if (!error) {
      await AsyncStorage.removeItem(SHARE_KEY).catch(() => {});

      const outcome = data as { ok?: boolean; plan_id?: string } | null;
      if (outcome?.ok && outcome.plan_id) {
        planId = outcome.plan_id;
      }
    }
  }

  if (inviteCode) {
    const { error } = await supabase.rpc("redeem_invite_code", {
      p_code: inviteCode,
    });

    if (!error) {
      await AsyncStorage.removeItem(INVITE_KEY).catch(() => {});
    }
  }

  return planId;
};

/**
 * Moves any locally stashed token onto the freshly created profile. Call right
 * after sign-up succeeds.
 */
export const attachPendingTokensToProfile = async (userId: string) => {
  const { shareToken, inviteCode } = await readPendingTokens();

  if (!shareToken && !inviteCode) {
    return;
  }

  const { error } = await supabase
    .from("profile_settings")
    .update({
      pending_share_token: shareToken,
      pending_invite_code: inviteCode,
    })
    .eq("id", userId);

  if (!error) {
    await clearPendingTokens();
  }
};
