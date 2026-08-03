import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { rememberInviteCode, rememberSource } from "@/core/auth/pendingToken";
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
  const { code, de } = useLocalSearchParams<{
    code: string;
    /** Por dónde llegó: lo pone `buildShareUrl` al repartir el enlace. */
    de?: string;
  }>();
  const { session } = useSession();

  const { data: name, isLoading, isError, refetch } = useInvitePreview(code);

  useEffect(() => {
    if (code) {
      void rememberInviteCode(code);
      // La etiqueta viaja con el enlace y se guarda **una sola vez**: quien
      // abre tres antes de decidirse entró por el primero.
      if (de) void rememberSource(de);
    }
  }, [code, de]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  return (
    <DawnBackground
      variant="radial"
      className="items-center justify-center gap-3 px-8"
    >
      <Text className="text-center font-serif-bold text-2xl text-plum">
        {/* Un código que ya no existe no es un error: se dice lo que hay, que
            es una invitación a la app, sin nombre. */}
        {name ? t("invite.landing", { name }) : t("invite.landingUnknown")}
      </Text>

      <Text className="text-center font-sans text-base leading-6 text-mist-ink">
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
    </DawnBackground>
  );
}
