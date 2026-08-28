import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { TabHeader } from "@/components/TabHeader";
import { CirclesPane } from "@/components/panes/CirclesPane";
import { CommunityPane } from "@/components/panes/CommunityPane";
import { RequestsPane } from "@/components/panes/RequestsPane";

import { Pill } from "@/components/ui/Pill";

const SEGMENTS = ["circles", "community", "requests"] as const;
type Segment = (typeof SEGMENTS)[number];

/**
 * Juntos: todo lo social en una pestaña, en tres segmentos — tus círculos,
 * la comunidad y el muro de peticiones. Antes eran una tab y dos rutas
 * sueltas colgando del pie de Orar; el mapa entero no se veía desde ningún
 * sitio. Las rutas /comunidad y /peticiones siguen vivas para enlaces y
 * avisos: esta pantalla y aquellas comparten los mismos panes.
 */
export default function Together() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>("circles");

  const labels: Record<Segment, string> = {
    circles: t("tabs.circles"),
    community: t("community.title"),
    requests: t("feed.title"),
  };

  return (
    <DawnBackground>
      <TabHeader title={t("tabs.together")} />
      <View
        className="w-full flex-row gap-2 px-7 pb-3 md:max-w-read md:self-center md:px-10"
        accessibilityRole="tablist"
      >
        {SEGMENTS.map((key) => (
          <Pill
            key={key}
            label={labels[key]}
            selected={segment === key}
            role="tab"
            onPress={() => setSegment(key)}
          />
        ))}
      </View>

      {segment === "circles" ? (
        <CirclesPane />
      ) : segment === "community" ? (
        <CommunityPane />
      ) : (
        <RequestsPane />
      )}
    </DawnBackground>
  );
}
