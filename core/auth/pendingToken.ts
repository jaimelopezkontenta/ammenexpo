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
