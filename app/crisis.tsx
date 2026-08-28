import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { Txt } from "@/components/ui/Text";
import { useScreenPadding } from "@/components/useScreenPadding";

/**
 * B1b — recursos inmediatos, no moderación.
 *
 * A dónde llega quien acaba de escribir una frase de crisis, en el momento —
 * `useWritePrayerRequest`/`useWriteComment` devuelven `crisisFlagged` desde el
 * propio `insert`, así que esto se enseña sin esperar a que nadie del equipo
 * revise nada.
 *
 * **Texto pendiente de revisión por especialista** (§2.9 y RDY-06 del plan):
 * el aviso, el 024 y el fallback internacional son un mínimo defendible, no
 * un protocolo aprobado. No hay diagnóstico, no hay intervención automática y
 * no hay ningún dato de esta pantalla en telemetría — ver
 * `docs/runbooks/crisis-es-en.md`.
 */
const call = (number: string) => {
  void Linking.openURL(`tel:${number}`);
};

export default function CrisisResources() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();

  return (
    <>
      <Stack.Screen
        options={{
          // `title` se queda para el título del documento en web; el header
          // visible va mudo (`headerTitle`): el H1 serif de la pantalla ya
          // dice "Antes de seguir" y salía dos veces.
          title: t("crisis.title"),
          headerTitle: "",
          headerShown: true,
          // Una ceremonia entra de frente, no como un paso lateral más.
          animation: "fade_from_bottom",
          // Nadie sale de aquí por accidente: ni gesto, ni el back del
          // stack. Volver a `/peticiones/nueva` reabriría el borrador con
          // la frase de crisis todavía escrita. La salida es "Volver a Hoy".
          gestureEnabled: false,
          headerBackVisible: false,
          headerLeft: () => null,
        }}
      />
      <DawnBackground>
        <ScrollView
          contentContainerClassName="flex-grow gap-6 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          <Txt variant="title">{t("crisis.title")}</Txt>

          <Txt variant="body" accessibilityRole="alert">
            {t("crisis.intro")}
          </Txt>

          <Txt variant="caption">{t("crisis.notDiagnosis")}</Txt>

          <Txt variant="caption" accessibilityRole="alert">
            {t("crisis.draftPrivate")}
          </Txt>

          <Card className="gap-4">
            <Txt variant="subheadingLg">{t("crisis.resourcesTitle")}</Txt>

            <View className="gap-2">
              <Txt variant="bodyMedium">{t("crisis.resourceEsTitle")}</Txt>
              <Txt variant="caption">{t("crisis.resourceEsBody")}</Txt>
              <Button
                title={t("crisis.call024")}
                accessibilityRole="link"
                onPress={() => call("024")}
              />
            </View>

            <View className="gap-2">
              <Txt variant="bodyMedium">{t("crisis.resourceIntlTitle")}</Txt>
              <Txt variant="caption">{t("crisis.resourceIntlBody")}</Txt>
              <Button
                title={t("crisis.call112")}
                variant="secondary"
                accessibilityRole="link"
                onPress={() => call("112")}
              />
            </View>

            <Txt variant="label" tone="danger">
              {t("crisis.resourceEmergency")}
            </Txt>
          </Card>

          <Txt variant="caption">{t("crisis.staying")}</Txt>

          <View className="mt-auto gap-3 pt-6">
            <Button
              title={t("crisis.goHome")}
              onPress={() => router.replace("/")}
            />
          </View>
        </ScrollView>
      </DawnBackground>
    </>
  );
}
