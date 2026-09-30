/**
 * Las dos «Renovar el enlace» de la app —la del círculo y la tuya— son la
 * misma pregunta con distinto sujeto: qué deja de funcionar y qué se queda.
 * Cada una con su copy, en un sitio, para que `RotateInviteLink` no reparta
 * claves sueltas por dos pantallas.
 */
export type InviteRotationKind = "circle" | "app";

export type InviteRotationCopy = {
  /** El botón que abre la pregunta. */
  action: string;
  /** Lo que avisa el lector de pantalla antes de tocarlo. */
  hint: string;
  title: string;
  /** Lo que deja de valer y lo que se queda como estaba. */
  body: string;
  confirm: string;
  /** El toast de después. */
  done: string;
};

export const INVITE_ROTATION_COPY: Record<
  InviteRotationKind,
  InviteRotationCopy
> = {
  circle: {
    action: "circles.rotateInvite",
    hint: "circles.rotateInviteHint",
    title: "circles.rotateInviteTitle",
    body: "circles.rotateInviteBody",
    confirm: "circles.rotateInviteConfirm",
    done: "circles.rotateInviteDone",
  },
  app: {
    action: "invite.rotate",
    hint: "invite.rotateHint",
    title: "invite.rotateTitle",
    body: "invite.rotateBody",
    confirm: "invite.rotateConfirm",
    done: "invite.rotateDone",
  },
};
