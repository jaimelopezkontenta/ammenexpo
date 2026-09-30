import type { Circle, CircleMember } from "./queries";

/**
 * Quién ve «Renovar el enlace de invitación»: la misma regla que
 * `rotate_circle_invite_token` (quien creó el círculo, o un miembro con rol
 * owner/admin).
 *
 * Enseñárselo a alguien más sería un botón que siempre acaba en «algo salió
 * mal» (la RPC responde 42501). Con el censo sin cargar o fallido no hay rol
 * que mirar, y solo cuenta la propiedad del círculo, que viene con su fila.
 */
export const canRotateCircleInvite = (
  userId: string | null | undefined,
  circle: Pick<Circle, "owner_id">,
  members: readonly Pick<CircleMember, "user_id" | "role">[] | undefined,
): boolean => {
  if (!userId) return false;
  if (circle.owner_id === userId) return true;

  return (members ?? []).some(
    (member) =>
      member.user_id === userId &&
      (member.role === "owner" || member.role === "admin"),
  );
};
