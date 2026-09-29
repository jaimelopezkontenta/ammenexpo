import * as Localization from "expo-localization";
import { router, Stack } from "expo-router";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DawnBackground } from "@/components/DawnBackground";
import { Txt } from "@/components/ui/Text";
import { useScreenPadding } from "@/components/useScreenPadding";
import {
  emergencyNumberFor,
  FIND_A_HELPLINE_URL,
  selectCrisisLines,
  telUrl,
} from "@/core/crisis/resources";

/**
 * B1b — recursos inmediatos, no moderación.
 *
 * A dónde llega quien acaba de escribir una frase de crisis, en el momento —
 * `useWritePrayerRequest`/`useWriteComment` devuelven `crisisFlagged` desde el
 * propio `insert`, así que esto se enseña sin esperar a que nadie del equipo
 * revise nada.
 *
 * **Texto y números pendientes de revisión por especialista** (§2.9 y RDY-06
 * del plan): la línea del país del dispositivo, España si la app está en
 * español y, para el resto, un buscador por país y los números de
 * emergencias. Un mínimo defendible, no un protocolo aprobado. No hay
 * diagnóstico, no hay intervención automática y no hay ningún dato de esta
 * pantalla en telemetría — ver `docs/runbooks/crisis-es-en.md` y la tabla
 * de `core/crisis/resources.ts`.
 */
const open = (url: string) => {
  // Sin marcador (una tableta, el escritorio) no hay nada que abrir; no es
  // un error que haya que enseñar aquí.
  Linking.openURL(url).catch(() => {});
};

/**
 * La región del dispositivo (`ES`, `MX`…), no la del idioma de la app: la app
 * abre en español en cualquier país. Si no se puede leer, no hay región y la
 * pantalla sigue con lo demás.
 *
 * En web la página se prerenderiza en el build, sin región del visitante:
 * por eso va por `useSyncExternalStore` con `null` como valor de servidor, y
 * la región entra justo después de hidratar sin romper la hidratación. En el
 * teléfono no hay prerender y se lee de entrada.
 */
const deviceRegion = (): string | null => {
  try {
    return Localization.getLocales()[0]?.regionCode ?? null;
  } catch {
    return null;
  }
};

// La región no cambia mientras se mira esta pantalla: no hay a qué suscribirse.
const noSubscription = () => () => {};
const noRegion = () => null;

export default function CrisisResources() {
  const { t, i18n } = useTranslation();
  const { scrollBottom } = useScreenPadding();

  const region = useSyncExternalStore(noSubscription, deviceRegion, noRegion);

  const language = i18n.resolvedLanguage ?? i18n.language;
  const lines = selectCrisisLines({ regionCode: region, language });
  const emergency = emergencyNumberFor(region);

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

            {lines.map((line, index) => (
              <View key={line.region} className="gap-2">
                <Txt variant="bodyMedium">
                  {t(`crisis.lines.${line.region}.title`)}
                </Txt>
                <Txt variant="caption">
                  {t(`crisis.lines.${line.region}.body`)}
                </Txt>
                <Button
                  title={t("crisis.callNumber", { number: line.display })}
                  // La primera es la más cercana: la del país, o la de
                  // España si no hay país. Las demás, un paso por detrás.
                  variant={index === 0 ? "primary" : "secondary"}
                  accessibilityRole="link"
                  onPress={() => open(telUrl(line.phone))}
                />
              </View>
            ))}

            <View className="gap-2">
              <Txt variant="bodyMedium">
                {lines.length > 0
                  ? t("crisis.otherCountriesTitle")
                  : t("crisis.findYourLineTitle")}
              </Txt>
              <Txt variant="caption">{t("crisis.otherCountriesBody")}</Txt>
              <Button
                title={t("crisis.findHelpline")}
                variant={lines.length > 0 ? "secondary" : "primary"}
                accessibilityRole="link"
                onPress={() => open(FIND_A_HELPLINE_URL)}
              />
              <Txt variant="caption">{t("crisis.emergencyNumbers")}</Txt>
            </View>

            <View className="gap-2">
              <Txt variant="label" tone="danger">
                {t("crisis.resourceEmergency")}
              </Txt>
              {/* Solo el número del país del dispositivo: el de otro país
                podría no existir allí. Sin país, queda el texto de arriba. */}
              {emergency ? (
                <Button
                  title={t("crisis.callEmergency", { number: emergency })}
                  variant="secondary"
                  accessibilityRole="link"
                  onPress={() => open(telUrl(emergency))}
                />
              ) : null}
            </View>
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
