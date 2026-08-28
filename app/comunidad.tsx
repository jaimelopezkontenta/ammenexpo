import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { DawnBackground } from "@/components/DawnBackground";
import { CommunityPane } from "@/components/panes/CommunityPane";

/** La ruta clásica; el contenido vive en el pane, compartido con Juntos. */
export default function Community() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen
        options={{ title: t("community.title"), headerShown: true }}
      />
      <DawnBackground>
        <CommunityPane />
      </DawnBackground>
    </>
  );
}
