import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { DawnBackground } from "@/components/DawnBackground";
import { RequestsPane } from "@/components/panes/RequestsPane";

/** La ruta clásica (muro abierto o de un círculo); el contenido es el pane. */
export default function PrayerRequests() {
  const { t } = useTranslation();
  const { circulo } = useLocalSearchParams<{ circulo?: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          title: circulo ? t("feed.circleTitle") : t("feed.title"),
          headerShown: true,
        }}
      />
      <DawnBackground>
        <RequestsPane circulo={circulo} />
      </DawnBackground>
    </>
  );
}
