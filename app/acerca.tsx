import Constants from "expo-constants";
import { Link, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

const SUPPORT_EMAIL = "hola@ammen.app";

/**
 * Qué es esto, qué versión estás usando y a dónde escribir.
 *
 * La versión no es un adorno: es lo primero que hace falta cuando alguien
 * cuenta un fallo, y hasta ahora no había forma de saberla desde dentro de la
 * app. Sale de `expo-constants`, que la lee de `app.json`, así que no hay un
 * segundo número que se olvide de subir.
 *
 * Aquí vivirán los términos y la política de privacidad cuando lleguen (N5): la
 * Guideline 1.2 los pide dentro de la app, no en una web aparte.
 */
export default function About() {
  const { t } = useTranslation();

  const version = Constants.expoConfig?.version ?? "—";

  return (
    <>
      <Stack.Screen
        options={{ title: t("profile.about"), headerShown: true }}
      />

      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="flex-grow gap-6 px-7 py-8"
      >
        <Text className="font-serif text-base leading-reading text-ink">
          {t("profile.aboutBody")}
        </Text>

        {/* Dicho aquí y no escondido: el plan lo escribe un modelo, y en materia
            religiosa eso hay que decirlo en voz alta. */}
        <Text className="text-sm leading-6 text-ink-muted">
          {t("profile.aboutAi")}
        </Text>

        {/* Los dos documentos, siempre a mano y no solo en la puerta de
            entrada: quien quiera releer qué aceptó tiene que poder. */}
        <View className="gap-3">
          <Link
            href={{ pathname: "/legal/[doc]", params: { doc: "terminos" } }}
          >
            <Text className="text-base text-clay underline">
              {t("legal.terms")}
            </Text>
          </Link>

          <Link
            href={{ pathname: "/legal/[doc]", params: { doc: "privacidad" } }}
          >
            <Text className="text-base text-clay underline">
              {t("legal.privacy")}
            </Text>
          </Link>
        </View>

        <View className="gap-2">
          <Text className="text-sm text-ink-soft">
            {t("profile.version", { version })}
          </Text>

          <Pressable
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
            <Text className="text-base text-clay underline">
              {t("profile.support")}
            </Text>
          </Pressable>

          <Text className="text-sm leading-6 text-ink-muted">
            {t("profile.supportHint")}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
