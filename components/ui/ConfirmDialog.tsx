import { View } from "react-native";

import { Button } from "@/components/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Txt } from "@/components/ui/Text";

/**
 * «¿Seguro?» para lo que cuesta deshacer: bloquear a alguien, salir de un
 * círculo, borrar.
 *
 * Bloquear era un toque sin confirmación en cuatro sitios (quién oró por ti,
 * la lista del círculo, el chat, la comunidad), junto a acciones que no
 * rompen nada. Es una `Sheet`, así que hereda su «Cerrar» anunciado, el
 * arrastre y el botón de atrás de Android como «cancelar».
 */
export const ConfirmDialog = ({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /**
   * Destructivo: el aviso va en rojo y confirmar no lleva el melocotón del
   * CTA — lo que rompe algo nunca es la acción más llamativa de la pantalla
   * (el mismo criterio que «Borrar mi cuenta» en Perfil).
   */
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <Sheet visible={visible} onClose={onClose} title={title}>
    {message ? (
      <Txt variant="body" tone={danger ? "danger" : "secondary"}>
        {message}
      </Txt>
    ) : null}
    <View className="gap-3 pt-1">
      <Button
        title={confirmLabel}
        variant={danger ? "secondary" : "primary"}
        loading={pending}
        onPress={onConfirm}
      />
      <Button title={cancelLabel} variant="ghost" onPress={onClose} />
    </View>
  </Sheet>
);
