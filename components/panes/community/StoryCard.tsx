import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import type { FeedEntry } from "@/core/social/feed";

/**
 * Un testimonio o un plan público.
 *
 * Los dos llevan reportar y bloquear. Sin eso, el testimonio de un desconocido
 * era una tarjeta que no se podía tocar de ninguna forma — el mismo agujero que
 * tenían las peticiones aquí, en esta misma pantalla.
 */
export const StoryCard = ({
  entry,
  onReport,
  onBlock,
}: {
  entry: FeedEntry;
  onReport: () => void;
  onBlock: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <View className="gap-3 rounded-card border border-glassedge/65 bg-glass/60 p-5 shadow-soft">
      <View className="flex-row items-center gap-2">
        <Avatar
          name={entry.author_name ?? ""}
          url={entry.author_avatar_url}
          seed={entry.author_id ?? entry.id}
          size={28}
        />

        <Link
          href={{
            pathname: "/persona/[id]",
            params: { id: entry.author_id ?? "" },
          }}
          asChild
        >
          <Tap accessibilityRole="link" className="flex-1">
            <Txt variant="label" tone="secondary">
              {entry.author_name}
            </Txt>
          </Tap>
        </Link>

        {/* Qué es cada fila. Sin esto, un testimonio y una petición se leen
            igual, y son cosas muy distintas: una pide, la otra cuenta. */}
        <Txt variant="overline">{t(`community.kind.${entry.kind}`)}</Txt>
      </View>

      {entry.title ? (
        <Txt variant="title" className="text-base">
          {entry.title}
        </Txt>
      ) : null}

      {entry.body ? <Txt variant="bodySerifReading">{entry.body}</Txt> : null}

      <View className="flex-row flex-wrap gap-4">
        {entry.kind === "plan" ? (
          // Comunidad solo enseña planes `public` (home_feed los filtra así),
          // y desde B2 esos ya no se abren en /orar/[planId] sin un share
          // explícito: la lectura y la oración dejaron de ser la misma ruta.
          <Link
            href={{
              pathname: "/plan-publico/[planId]",
              params: { planId: entry.id },
            }}
            asChild
          >
            <Tap accessibilityRole="link">
              <Txt variant="caption" tone="accent" className="underline">
                {t("community.openPlan")}
              </Txt>
            </Tap>
          </Link>
        ) : (
          <Link href="/testimonios" asChild>
            <Tap accessibilityRole="link">
              <Txt variant="caption" tone="accent" className="underline">
                {t("community.openTestimonies")}
              </Txt>
            </Tap>
          </Link>
        )}

        {entry.is_mine ? null : (
          <>
            <Tap accessibilityRole="button" onPress={onReport}>
              <Txt variant="caption" className="underline">
                {t("moderation.report")}
              </Txt>
            </Tap>

            <Tap
              accessibilityRole="button"
              accessibilityLabel={`${t("moderation.block")} ${entry.author_name ?? ""}`}
              onPress={onBlock}
            >
              <Txt variant="caption" className="underline">
                {t("moderation.block")}
              </Txt>
            </Tap>
          </>
        )}
      </View>
    </View>
  );
};
