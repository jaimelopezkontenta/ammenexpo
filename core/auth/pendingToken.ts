import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  planIdToOpenAfterRedeem,
  type RedeemShareResult,
} from "@/core/plans/redeemOutcome";
import { supabase } from "@/utils/supabase";

const SHARE_KEY = "ammen.pendingShareToken";
const INVITE_KEY = "ammen.pendingInviteCode";
const SOURCE_KEY = "ammen.signupSource";

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

/**
 * Por dónde llegó, guardado junto al token que lo trajo.
 *
 * Se escribe una sola vez: quien abre tres enlaces antes de decidirse entró por
 * el primero, y quedarse con el último convertiría un dato de adquisición en un
 * dato de la última cosa que le dio pereza cerrar.
 */
export const rememberSource = async (source: string) => {
  try {
    const already = await AsyncStorage.getItem(SOURCE_KEY);
    if (already) return;

    await AsyncStorage.setItem(SOURCE_KEY, source);
  } catch {
    // Mejor sin el dato que rompiendo la pantalla que trae a alguien nuevo.
  }
};

export const readPendingTokens = async () => {
  try {
    const [shareToken, inviteCode, source] = await Promise.all([
      AsyncStorage.getItem(SHARE_KEY),
      AsyncStorage.getItem(INVITE_KEY),
      AsyncStorage.getItem(SOURCE_KEY),
    ]);

    return { shareToken, inviteCode, source };
  } catch {
    return { shareToken: null, inviteCode: null, source: null };
  }
};

/**
 * Lo escribe en el perfil **una sola vez**, y solo si está vacío: reescribirlo
 * en cada inicio de sesión lo convertiría en «lo último que tocó» en vez de «por
 * dónde entró».
 */
export const attachSignupSource = async (userId: string) => {
  const { source } = await readPendingTokens();

  if (!source) return;

  try {
    await supabase
      .from("profile_settings")
      .update({ signup_source: source })
      .eq("id", userId)
      .is("signup_source", null);

    await AsyncStorage.removeItem(SOURCE_KEY);
  } catch {
    // Un dato de analítica no puede impedirle a nadie entrar en la app.
  }
};

/**
 * Olvida el token guardado, pero solo si es el mismo que se acaba de canjear:
 * quien abrió dos enlaces seguidos conserva el segundo.
 */
const forgetShareToken = async (token: string) => {
  try {
    if ((await AsyncStorage.getItem(SHARE_KEY)) === token) {
      await AsyncStorage.removeItem(SHARE_KEY);
    }
  } catch {
    // Como mucho se reintenta en el próximo arranque, y el RPC es idempotente.
  }
};

/**
 * Canjea un token de plan compartido y lo olvida en cuanto el servidor
 * responde. Es la única puerta al RPC: la pantalla `/p/[token]` guardaba el
 * token al abrirse y lo canjeaba, pero no lo borraba, así que el siguiente
 * arranque lo volvía a canjear y secuestraba la navegación hacia `/orar/…`.
 *
 * Un token revocado o caducado responde `{ok:false}` sin error: reintentarlo en
 * cada arranque no sirve, así que también se olvida. Un fallo de red sí da
 * error, y ese se conserva para la próxima.
 */
export const redeemShareToken = async (token: string) => {
  const { data, error } = await supabase.rpc("redeem_share_token", {
    p_token: token,
  });

  if (!error) {
    await forgetShareToken(token);
  }

  return { result: data as RedeemShareResult | null, error };
};

export const clearPendingTokens = async () => {
  try {
    await AsyncStorage.multiRemove([SHARE_KEY, INVITE_KEY, SOURCE_KEY]);
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
    const { result, error } = await redeemShareToken(shareToken);

    if (!error) {
      planId = planIdToOpenAfterRedeem(result);
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
