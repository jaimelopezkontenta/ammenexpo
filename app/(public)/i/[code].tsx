import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { rememberInviteCode } from "@/core/auth/pendingToken";
import { useSession } from "@/core/auth/SessionProvider";
import { useInvitePreview } from "@/core/social/invites";

/**
 * El enlace de una invitación a Ammen.
 *
 * `rememberInviteCode` llevaba exportada desde la Fase 2 **sin que la llamara
 * nadie**: no había ruta que capturara un código, así que la cadena entera —
 * guardar, adjuntar al perfil, canjear — estaba construida y no arrancaba por
 * ningún sitio.
 *
 * Aquí no se canjea nada: se guarda y ya. El canje ocurre en cualquier inicio
 * de sesión (`SessionProvider`), que es el único punto por el que pasan los
 * cuatro caminos — registro directo, registro con correo de confirmación,
 * cuenta que ya existía, y sesión abierta.
 */
export default function InviteLanding() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useSession();

  const { data: name, isLoading, isError, refetch } = useInvitePreview(code);

  useEffect(() => {
    if (code) {
      void rememberInviteCode(code);
    }
  }, [code]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-paper px-8">
      <Text className="text-center font-serif-bold text-2xl text-ink">
        {/* Un código que ya no existe no es un error: se dice lo que hay, que
            es una invitación a la app, sin nombre. */}
        {name ? t("invite.landing", { name }) : t("invite.landingUnknown")}
      </Text>

      <Text className="text-center text-base leading-6 text-ink-muted">
        {t("invite.body")}
      </Text>

      {/* Este grupo no tiene cabecera, así que sin salidas alguien que abre un
          enlace de WhatsApp se queda mirando dos líneas de texto. */}
      <View className="mt-6 w-full gap-3">
        {session ? (
          <Button
            title={t("share.goHome")}
            onPress={() => router.replace("/")}
          />
        ) : (
          <>
            <Link href="/crear-cuenta" asChild>
              <Button title={t("share.deadLinkCta")} />
            </Link>
            <Link href="/entrar" asChild>
              <Button title={t("share.alreadyMember")} variant="ghost" />
            </Link>
          </>
        )}
      </View>
    </View>
  );
}
