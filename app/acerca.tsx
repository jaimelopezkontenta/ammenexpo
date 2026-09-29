import Constants from "expo-constants";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, View } from "react-native";

import { ExportData } from "@/components/ExportData";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { Txt } from "@/components/ui/Text";

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

  const version = Constants.expoConfig?.version ?? "—";

  return (
    <ScreenScaffold
      title={t("profile.about")}
      contentClassName="flex-grow gap-6"
    >
      <Txt variant="bodySerifReading">{t("profile.aboutBody")}</Txt>

      {/* Dicho aquí y no escondido: el plan lo escribe un modelo, y en materia
            religiosa eso hay que decirlo en voz alta. */}
      <Txt variant="caption">{t("profile.aboutAi")}</Txt>

      {/* Los dos documentos, siempre a mano y no solo en la puerta de
            entrada: quien quiera releer qué aceptó tiene que poder. */}
      <View className="gap-3">
        <Link href={{ pathname: "/legal/[doc]", params: { doc: "terminos" } }}>
          <Txt variant="body" tone="accent" underline>
            {t("legal.terms")}
          </Txt>
        </Link>

        <Link
          href={{ pathname: "/legal/[doc]", params: { doc: "privacidad" } }}
        >
          <Txt variant="body" tone="accent" underline>
            {t("legal.privacy")}
          </Txt>
        </Link>
      </View>

      <View className="gap-2">
        <Txt variant="caption">{t("profile.version", { version })}</Txt>

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
          <Txt variant="body" tone="accent" underline>
            {t("profile.support")}
          </Txt>
        </Tap>

        <Txt variant="caption">{t("profile.supportHint")}</Txt>
      </View>

      {/* Llevarte tus datos. Iba junto a borrar la cuenta hasta que me di
            cuenta de que ahí solo lo ve quien ya se está yendo — y esto sirve
            sobre todo para quien se queda y quiere saber qué hay guardado.
            También vive en Perfil, donde se busca primero. */}
      <ExportData />
    </ScreenScaffold>
  );
}
