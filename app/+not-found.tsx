import { Link, Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { DawnBackground } from "@/components/DawnBackground";
import { Orb } from "@/components/Orb";
import { Wordmark } from "@/components/Wordmark";
import { Txt } from "@/components/ui/Text";

/**
 * La única pantalla que se ve al equivocarse de enlace. Antes eran dos líneas
 * grises sin marca: quien llegaba desde un link roto de WhatsApp no veía ni
 * de qué app era. Ahora es la misma casa — el orbe, la voz editorial y el
 * camino de vuelta.
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("common.appName") }} />
      <DawnBackground className="items-center justify-center gap-4 px-8">
        <Orb size={72} animated={false} />
        <Txt variant="heading" className="text-center">
          {t("common.notFoundTitle")}
        </Txt>
        <Link
          href="/"
          className="min-h-11 py-2 text-center font-sans-semibold text-base text-ember-ink underline"
        >
          {t("common.notFoundLink")}
        </Link>
        <Wordmark />
      </DawnBackground>
    </>
  );
}
