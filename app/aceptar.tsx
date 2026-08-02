import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
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
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="flex-grow justify-center gap-6 px-7 py-12"
    >
      <Text className="font-serif-bold text-2xl text-ink">
        {t("legal.gateTitle")}
      </Text>

      <Text className="text-base leading-6 text-ink-muted">
        {t("legal.gateBody")}
      </Text>

      {/* Los dos documentos, para leerlos antes de aceptarlos. Sin esto, "acepto"
          sería un botón sobre algo que no se puede ver. */}
      <View className="gap-3">
        <Link href={{ pathname: "/legal/[doc]", params: { doc: "terminos" } }}>
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

      <Button
        title={t("legal.accept")}
        loading={accept.isPending}
        onPress={() => void handleAccept()}
      />

      {error ? (
        <Text className="text-sm text-red-500" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {/* No aceptar tiene que llevar a algún sitio. Sin esta salida, quien no
          esté de acuerdo se queda encerrado en una pantalla con un solo botón. */}
      <Button
        title={t("auth.signOut")}
        variant="ghost"
        onPress={() => void signOut()}
      />
    </ScrollView>
  );
}
