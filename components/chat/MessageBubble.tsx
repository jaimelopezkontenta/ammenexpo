import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Avatar } from "@/components/Avatar";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import type { ChatMessage } from "@/core/circles/chat";
import { sameCalendarDay } from "@/core/circles/chatPages";
import { enterListItem } from "@/theme/motion";

/**
 * Lo que una burbuja puede pedir, con el id por argumento: un solo objeto
 * estable para todas, así `memo` compara lo mismo de un render al siguiente.
 */
export type MessageActions = {
  toggleMenu: (messageId: string) => void;
  report: (messageId: string) => void;
  block: (senderId: string, name: string) => void;
  hide: (messageId: string) => void;
};

type Props = {
  message: ChatMessage;
  /** Su sitio en la lista (0 es la más reciente). Solo cuenta al montarse. */
  index: number;
  /** Es el primer mensaje de su día: lleva el separador encima. */
  opensDay: boolean;
  /** Abre racha: la cara y el nombre de quien escribe no se repiten. */
  opensRun: boolean;
  menuOpen: boolean;
  isAdmin: boolean;
  locale: string;
  /** Hoy (`toDateString()`): cambia a medianoche, y con él «Hoy» y «Ayer». */
  today: string;
  actions: MessageActions;
};

const Bubble = ({
  message: item,
  index,
  opensDay,
  opensRun,
  menuOpen,
  isAdmin,
  locale,
  today,
  actions,
}: Props) => {
  const { t } = useTranslation();

  // Entrada solo en las burbujas visibles al abrir (la lista está invertida:
  // 0 es la más reciente); el resto llega por scroll y animarlo sería trabajo
  // que nadie ve. Reanimated solo mira `entering` al montar, así que se fija
  // con el sitio que la burbuja tenía entonces.
  const [entering] = useState(() => enterListItem(index));

  // Un chat sin fechas ni horas es una conversación sin memoria: "¿esto fue
  // hoy?" no debería ser una pregunta. La hora vive dentro de la burbuja; el
  // día, en un separador cuando cambia.
  const dayLabel = useMemo(() => {
    if (!opensDay) return null;

    const date = new Date(item.created_at);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (sameCalendarDay(date, now)) return t("chat.today");
    if (sameCalendarDay(date, yesterday)) return t("chat.yesterday");
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
    }).format(date);
    // `today` no se lee: está para recalcular «Hoy»/«Ayer» al cambiar el día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opensDay, item.created_at, locale, t, today]);

  const timeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(item.created_at)),
    [item.created_at, locale],
  );

  return (
    <Animated.View entering={entering}>
      {dayLabel ? (
        <Txt variant="editorial" className="pb-3 pt-1 text-center">
          {dayLabel}
        </Txt>
      ) : null}
      <View className={item.is_mine ? "items-end" : "items-start"}>
        <View className="max-w-[85%] gap-1">
          {!item.is_mine && opensRun ? (
            <View className="flex-row items-center gap-2">
              <Avatar
                name={item.sender_name}
                url={item.sender_avatar_url}
                seed={item.sender_id}
                size={20}
              />
              <Txt variant="label" tone="secondary" className="text-xs">
                {item.sender_name}
              </Txt>
            </View>
          ) : null}

          <Tap
            accessibilityRole="button"
            accessibilityLabel={t("chat.messageActions", {
              name: item.sender_name,
            })}
            // A tap, not a long press. Long press is invisible — on the
            // web it is not even a convention — and the stores require
            // reporting and blocking to be *findable*, which a gesture
            // nothing on screen hints at is not.
            onPress={() => actions.toggleMenu(item.id)}
            // La burbuja propia es vidrio oscuro y la ajena vidrio
            // claro, como en el diseño. Ninguna de las dos desenfoca: van
            // dentro de una lista virtualizada, y ahí el desenfoque se
            // recompone en cada fila que entra.
            className={`rounded-card border px-4 py-3 ${
              item.is_mine
                ? "border-white/30 bg-plum-chip"
                : "border-glassedge/60 bg-glass/60"
            }`}
          >
            <Txt variant="body" tone={item.is_mine ? "onDark" : "primary"}>
              {item.body}
            </Txt>
            {/* La hora dentro de la burbuja, como en cualquier chat:
                pequeña, al filo, sin robarle línea al mensaje. */}
            <Txt
              variant="captionSm"
              tone={item.is_mine ? "onDark" : undefined}
              className={`self-end pt-0.5 ${item.is_mine ? "opacity-70" : ""}`}
            >
              {timeLabel}
            </Txt>
          </Tap>

          {/* Behind a tap rather than always visible: every message
              carrying three moderation links would make the circle read
              like a place where trouble is expected. */}
          {menuOpen && !item.is_mine ? (
            <View className="flex-row flex-wrap gap-4 pt-1">
              <Tap
                accessibilityRole="button"
                onPress={() => actions.report(item.id)}
                className="min-h-11 justify-center"
              >
                <Txt variant="caption">{t("moderation.report")}</Txt>
              </Tap>

              <Tap
                accessibilityRole="button"
                onPress={() => actions.block(item.sender_id, item.sender_name)}
                className="min-h-11 justify-center"
              >
                <Txt variant="caption">{t("moderation.block")}</Txt>
              </Tap>

              {isAdmin ? (
                <Tap
                  accessibilityRole="button"
                  onPress={() => actions.hide(item.id)}
                  className="min-h-11 justify-center"
                >
                  <Txt variant="caption">{t("moderation.hide")}</Txt>
                </Tap>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
};

/**
 * Todo cuenta menos `index`: con la lista invertida, cada mensaje nuevo entra
 * en el 0 y desplaza a todos los demás un sitio. Si el índice contara, cada
 * mensaje que llega repintaría la conversación entera, y solo sirve para la
 * entrada, que ya pasó.
 */
const sameBubble = (prev: Props, next: Props) =>
  (Object.keys(next) as (keyof Props)[]).every(
    (key) => key === "index" || Object.is(prev[key], next[key]),
  );

/**
 * Un mensaje del chat: su separador de día, quién lo escribe si abre racha, la
 * burbuja con la hora y, al tocarla, reportar, bloquear u ocultar.
 */
export const MessageBubble = memo(Bubble, sameBubble);
