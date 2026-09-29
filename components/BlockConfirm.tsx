import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type BlockTarget = { id: string; name: string };

/**
 * «¿Bloquear a Ana?» — el aviso que faltaba antes de bloquear.
 *
 * Bloquear era un toque sin confirmación junto a «Reportar», que tampoco rompe
 * nada: el toque de al lado llevaba a perder de vista a alguien en toda la app
 * (y a que esa persona deje de ver lo tuyo). El texto cuenta qué pasa y dónde
 * se deshace, que es lo que hace que un bloqueo hecho con prisa no sea una
 * trampa.
 */
export const BlockConfirmDialog = ({
  target,
  onConfirm,
  onClose,
}: {
  target: BlockTarget | null;
  onConfirm: (target: BlockTarget) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();

  // Mientras la hoja se va con su fundido `target` ya es null: se recuerda a
  // quién se preguntaba para que el título no salte a «¿Bloquear a ?» en la
  // salida. (Ajustar estado al recibir props: el patrón de React, sin efecto.)
  const [shown, setShown] = useState<BlockTarget | null>(target);
  if (target && target !== shown) setShown(target);

  return (
    <ConfirmDialog
      visible={target !== null}
      danger
      title={t("moderation.blockConfirmTitle", {
        name: shown?.name.trim() || t("moderation.blockThisPerson"),
      })}
      message={t("moderation.blockConfirmBody")}
      confirmLabel={t("moderation.blockConfirm")}
      cancelLabel={t("common.cancel")}
      onConfirm={() => {
        if (target) onConfirm(target);
      }}
      onClose={onClose}
    />
  );
};

/**
 * El estado de la pregunta, para quien tiene un botón «Bloquear» por fila.
 *
 * `ask(id, nombre)` abre la hoja; al confirmar se cierra y se llama a
 * `execute(id)` — cada pantalla conserva su propio `run` y su forma de decir
 * «listo» o «no se pudo». `dialog` se monta una vez por pantalla, donde sea:
 * el Modal no ocupa sitio en el flujo (en nativo es absoluto; en web va a un
 * portal), así que ni un `gap` ni un scroll lo notan.
 */
export const useBlockConfirm = (execute: (blockedId: string) => void) => {
  const [target, setTarget] = useState<BlockTarget | null>(null);

  const ask = useCallback(
    (id: string, name: string) => setTarget({ id, name }),
    [],
  );

  const dialog = (
    <BlockConfirmDialog
      target={target}
      onClose={() => setTarget(null)}
      onConfirm={(who) => {
        setTarget(null);
        execute(who.id);
      }}
    />
  );

  return { ask, dialog };
};
