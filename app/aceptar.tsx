import { Link, Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { Txt } from "@/components/ui/Text";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useSession } from "@/core/auth/SessionProvider";
import { useAcceptTerms } from "@/core/legal/queries";

/**
 * La puerta: aceptar los términos antes de usar nada.
 *
 * Va **antes del onboarding**, no después. El onboarding pregunta qué estás
 * viviendo y por qué te gustaría orar; pedir eso antes de decir qué hacemos con
 * lo que nos cuentas es el orden equivocado.
 *
 * Y va como puerta y no como una casilla en el alta porque tiene que alcanzar
 * también a quien ya tiene cuenta —y al día que el texto cambie de forma
 * importante—. El gate compara la versión aceptada con la actual, así que subir
 * `TERMS_VERSION` vuelve a preguntar a todo el mundo, una vez.
 */
export default function AcceptTerms() {
  const { t } = useTranslation();
  const { top, scrollBottom } = useScreenPadding();
  const { signOut } = useSession();
  const accept = useAcceptTerms();

  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setError(null);

    try {
      await accept.mutateAsync();
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  return (
    <DawnBackground>
      {/* Una puerta entra de frente, no como un paso lateral más. */}
      <Stack.Screen options={{ animation: "fade_from_bottom" }} />
      <ScrollView
        contentContainerClassName="flex-grow justify-center gap-6 px-7 py-12 md:w-full md:max-w-read md:self-center"
        contentContainerStyle={{
          paddingTop: top,
          paddingBottom: scrollBottom,
        }}
      >
        <Txt variant="title">{t("legal.gateTitle")}</Txt>

        <Txt variant="body" tone="secondary">
          {t("legal.gateBody")}
        </Txt>

        {/* Los dos documentos, para leerlos antes de aceptarlos. Sin esto, "acepto"
          sería un botón sobre algo que no se puede ver. */}
        <View className="gap-3">
          <Link
            href={{ pathname: "/legal/[doc]", params: { doc: "terminos" } }}
          >
            <Txt variant="bodyMedium" tone="accent" className="underline">
              {t("legal.terms")}
            </Txt>
          </Link>

          <Link
            href={{ pathname: "/legal/[doc]", params: { doc: "privacidad" } }}
          >
            <Txt variant="bodyMedium" tone="accent" className="underline">
              {t("legal.privacy")}
            </Txt>
          </Link>
        </View>

        <Button
          title={t("legal.accept")}
          loading={accept.isPending}
          onPress={() => void handleAccept()}
        />

        {error ? (
          <Txt variant="caption" tone="danger" accessibilityRole="alert">
            {error}
          </Txt>
        ) : null}

        {/* No aceptar tiene que llevar a algún sitio. Sin esta salida, quien no
          esté de acuerdo se queda encerrado en una pantalla con un solo botón. */}
        <Button
          title={t("auth.signOut")}
          variant="ghost"
          onPress={() => void signOut()}
        />
      </ScrollView>
    </DawnBackground>
  );
}
