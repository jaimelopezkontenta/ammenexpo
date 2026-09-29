import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, TextInput, View } from "react-native";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useSendMessage } from "@/core/circles/chat";
import { useThemeColors } from "@/theme";

/**
 * Escribir y enviar, con el borrador dentro.
 *
 * Vive aparte de la pantalla por rendimiento: con el borrador arriba, cada
 * tecla repintaba el chat entero —la lista y todas sus burbujas—. Aquí cada
 * tecla repinta solo esto.
 */
export const ChatComposer = ({
  circleId,
  conversationId,
  userId,
}: {
  circleId: string | undefined;
  conversationId: string | null | undefined;
  userId: string | undefined;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { bottom } = useScreenPadding();

  const send = useSendMessage(circleId, conversationId, userId);
  const [draft, setDraft] = useState("");

  // El fallo de envío sí es local: vive junto al composer, con el borrador
  // restaurado, hasta el siguiente intento.
  const [error, setError] = useState<string | null>(null);

  // A send button that does nothing on an empty draft reads as broken; dimming
  // it says the same thing without the tap.
  const canSend = draft.trim().length > 0 && !send.isPending;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;

    setError(null);
    // Cleared before the round trip so typing the next line is not blocked by
    // the network, and restored if the send actually fails.
    setDraft("");

    try {
      await send.mutateAsync(body);
    } catch {
      setDraft(body);
      setError(t("chat.sendFailed"));
    }
  };

  return (
    <>
      {error ? (
        <Txt
          variant="caption"
          tone="danger"
          className="px-7 pb-2"
          accessibilityRole="alert"
        >
          {error}
        </Txt>
      ) : null}

      <View
        className="flex-row items-end gap-2 border-t border-glassedge/60 px-5 pt-3"
        style={{ paddingBottom: bottom }}
      >
        {/* A bare TextInput rather than TextField: the composer wants no
          visible label above it, and the accessible name is what matters. */}
        <TextInput
          className="max-h-32 min-w-0 flex-1 rounded-input border border-glassedge/70 bg-surface px-4 py-3 font-sans text-base text-plum"
          accessibilityLabel={t("chat.inputLabel")}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("chat.placeholder")}
          placeholderTextColor={colors.mist.ink}
          multiline
          // react-native-web renders a multiline input as `rows={2}`, so an
          // empty composer stood two lines tall next to a one-line button.
          // Most messages are one line; it grows from there on native and
          // scrolls inside `max-h-32` on the web.
          numberOfLines={1}
          maxLength={4000}
        />

        {/* Not the shared Button: that one is `w-full`, sized for a screen's
          primary action, so in this row it claimed everything and left the
          composer 33px wide. A send control belongs to its own label. */}
        <Tap
          accessibilityRole="button"
          accessibilityLabel={t("chat.send")}
          accessibilityState={{
            disabled: !canSend,
            busy: send.isPending,
          }}
          aria-busy={send.isPending}
          disabled={!canSend}
          onPress={() => void handleSend()}
          className={`h-12 shrink-0 items-center justify-center rounded-input bg-plum-chip px-5 ${
            canSend ? "" : "opacity-40"
          }`}
        >
          {send.isPending ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Txt variant="subheading" tone="onDark">
              {t("chat.send")}
            </Txt>
          )}
        </Tap>
      </View>
    </>
  );
};
