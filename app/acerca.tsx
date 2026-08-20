import Constants from "expo-constants";
import { Link, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { Button } from "@/components/Button";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useExportMyData } from "@/core/legal/export";

import { Tap } from "@/components/ui/Tap";

const SUPPORT_EMAIL = "hola@ammen.app";

/**
 * Qué es esto, qué versión estás usando y a dónde escribir.
 *
 * La versión no es un adorno: es lo primero que hace falta cuando alguien
 * cuenta un fallo, y hasta ahora no había forma de saberla desde dentro de la
 * app. Sale de `expo-constants`, que la lee de `app.json`, así que no hay un
 * segundo número que se olvide de subir.
 *
 * Los términos y la privacidad ya viven en `app/legal/[doc]` (texto en
 * `core/legal/documents.ts`) y están enlazados más abajo y desde `aceptar.tsx`.
 */
export default function About() {
  const { t } = useTranslation();
  const { scrollBottom } = useScreenPadding();
  const exportData = useExportMyData();

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const version = Constants.expoConfig?.version ?? "—";

  const handleExport = async () => {
    setNotice(null);
    setError(null);

    try {
      const outcome = await exportData.mutateAsync();
      setNotice(
        outcome === "downloaded"
          ? t("legal.exportDone")
          : t("legal.exportShared"),
      );
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ title: t("profile.about"), headerShown: true }}
      />

      <DawnBackground>
        <ScrollView
          contentContainerClassName="flex-grow gap-6 px-7 py-8 md:w-full md:max-w-read md:self-center"
          contentContainerStyle={{ paddingBottom: scrollBottom }}
        >
          <Text className="font-serif text-base leading-reading text-plum">
            {t("profile.aboutBody")}
          </Text>

          {/* Dicho aquí y no escondido: el plan lo escribe un modelo, y en materia
            religiosa eso hay que decirlo en voz alta. */}
          <Text className="font-sans text-sm leading-6 text-mist-ink">
            {t("profile.aboutAi")}
          </Text>

          {/* Los dos documentos, siempre a mano y no solo en la puerta de
            entrada: quien quiera releer qué aceptó tiene que poder. */}
          <View className="gap-3">
            <Link
              href={{ pathname: "/legal/[doc]", params: { doc: "terminos" } }}
            >
              <Text className="font-sans text-base text-ember-ink underline">
                {t("legal.terms")}
              </Text>
            </Link>

            <Link
              href={{ pathname: "/legal/[doc]", params: { doc: "privacidad" } }}
            >
              <Text className="font-sans text-base text-ember-ink underline">
                {t("legal.privacy")}
              </Text>
            </Link>
          </View>

          <View className="gap-2">
            <Text className="font-sans text-sm text-mist-ink">
              {t("profile.version", { version })}
            </Text>

            <Tap
              accessibilityRole="link"
              onPress={() => {
                // Abre el compositor de correo con la versión ya puesta. No manda
                // nada: lo escribe y lo envía la persona.
                void Linking.openURL(
                  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                    `Ammen ${version}`,
                  )}`,
                );
              }}
            >
              <Text className="font-sans text-base text-ember-ink underline">
                {t("profile.support")}
              </Text>
            </Tap>

            <Text className="font-sans text-sm leading-6 text-mist-ink">
              {t("profile.supportHint")}
            </Text>
          </View>

          {/* Llevarte tus datos. Iba junto a borrar la cuenta hasta que me di
            cuenta de que ahí solo lo ve quien ya se está yendo — y esto sirve
            sobre todo para quien se queda y quiere saber qué hay guardado. */}
          <View className="gap-2">
            <Button
              title={t("legal.export")}
              variant="secondary"
              loading={exportData.isPending}
              onPress={() => void handleExport()}
            />
            <Text className="font-sans text-sm leading-6 text-mist-ink">
              {t("legal.exportHint")}
            </Text>

            {notice ? (
              <Text
                className="font-sans text-sm text-mist-ink"
                accessibilityRole="alert"
              >
                {notice}
              </Text>
            ) : null}

            {error ? (
              <Text
                className="font-sans text-sm text-danger"
                accessibilityRole="alert"
              >
                {error}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </DawnBackground>
    </>
  );
}
