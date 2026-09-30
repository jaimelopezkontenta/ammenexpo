import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import {
  INVITE_ROTATION_COPY,
  type InviteRotationKind,
} from "@/components/inviteRotation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAction } from "@/core/toast/useAction";

/**
 * «Renovar el enlace»: para cuando un enlace de invitación ha llegado a donde
 * no debía (un grupo público, una captura). El de ahora deja de funcionar en
 * el acto y eso no se deshace, así que pregunta antes, y la pregunta dice
 * también lo que NO cambia: quien ya entró sigue dentro.
 *
 * Fantasma y al pie de lo de invitar: es la salida de emergencia, no algo que
 * compita con «Invitar».
 *
 * La hoja se cierra al terminar, salga bien o mal: el resultado va por toast,
 * y en nativo un toast debajo de un Modal abierto no se vería.
 */
export const RotateInviteLink = ({
  kind,
  rotate,
}: {
  kind: InviteRotationKind;
  /** La mutación; su resultado lo pinta la caché (el enlace nuevo en pantalla). */
  rotate: () => Promise<unknown>;
}) => {
  const { t } = useTranslation();
  const { run, pending } = useAction();
  const [asking, setAsking] = useState(false);
  const copy = INVITE_ROTATION_COPY[kind];

  const handleConfirm = async () => {
    await run(rotate, t(copy.done));
    setAsking(false);
  };

  return (
    <>
      <Button
        title={t(copy.action)}
        variant="ghost"
        accessibilityHint={t(copy.hint)}
        disabled={pending}
        onPress={() => setAsking(true)}
      />
      <ConfirmDialog
        visible={asking}
        danger
        pending={pending}
        title={t(copy.title)}
        message={t(copy.body)}
        confirmLabel={t(copy.confirm)}
        cancelLabel={t("common.cancel")}
        onConfirm={() => void handleConfirm()}
        onClose={() => setAsking(false)}
      />
    </>
  );
};
