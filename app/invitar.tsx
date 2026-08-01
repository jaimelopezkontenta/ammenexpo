import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useSession } from "@/core/auth/SessionProvider";
import { buildShareUrl, shareOrCopy } from "@/core/share";
import { useCreateInviteCode, useMyInviteCode } from "@/core/social/invites";

/**
 * Invitar a alguien a Ammen.
 *
 * Es la única vía de entrada para quien **todavía no tiene un plan que
 * compartir** —que es exactamente quien acaba de instalar la app— y llevaba
 * media construida desde la Fase 1: la tabla, las policies, el canje y las tres
 * cadenas traducidas, sin nada que insertara una fila.
 *
 * Quien entre por aquí acaba siguiéndote, que desde el bloque S es lo que hace
 * `redeem_invite_code`. Y se puede dejar de seguir con un toque, cosa que la
 * amistad silenciosa de antes no ofrecía.
 */
export default function Invite() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: code, isLoading, isError, refetch } = useMyInviteCode(userId);
  const create = useCreateInviteCode(userId);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleShare = async () => {
    setError(null);
    setNotice(null);

    try {
      // Se crea al pedirlo, no al abrir: navegar a un sitio no debería
      // escribir nada.
      const value = code ?? (await create.mutateAsync());
      const url = buildShareUrl(`/i/${value}`);

      const outcome = await shareOrCopy(t("invite.message"), url);

      // El tercer caso importa: en web, "copiado" y "compartido" son cosas
      // distintas y sin decirlo parece que no ha pasado nada.
      if (outcome === "copied") setNotice(t("share.linkCopied"));
      if (outcome === "failed") setError(t("share.shareFailed"));
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("invite.title"), headerShown: true }}
        />
        <LoadingState />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Stack.Screen
          options={{ title: t("invite.title"), headerShown: true }}
        />
        <ErrorState onRetry={() => void refetch()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("invite.title"), headerShown: true }} />

      <ScrollView
        className="flex-1 bg-paper"
        contentContainerClassName="flex-grow gap-6 px-7 py-8"
      >
        <Text className="font-serif text-lg leading-reading text-ink">
          {t("invite.body")}
        </Text>

        {code ? (
          <View className="gap-2">
            <Text className="text-sm font-medium text-ink-muted">
              {t("invite.linkLabel")}
            </Text>
            {/* Seleccionable a mano: es lo que salva el día que la hoja del
                sistema falla o el portapapeles está capado. */}
            <Text selectable className="text-base text-ink">
              {buildShareUrl(`/i/${code}`)}
            </Text>
          </View>
        ) : null}

        <Button
          title={t("invite.cta")}
          loading={create.isPending}
          onPress={() => void handleShare()}
        />

        {notice ? (
          <Text className="text-sm text-ink-muted" accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}

        {error ? (
          <Text className="text-sm text-red-500" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}
