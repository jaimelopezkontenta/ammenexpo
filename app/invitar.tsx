import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { Txt } from "@/components/ui/Text";
import { Card } from "@/components/Card";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { useSession } from "@/core/auth/SessionProvider";
import { buildShareUrl, shareOrCopy } from "@/core/share";
import { useCreateInviteCode, useMyInviteCode } from "@/core/social/invites";
import { useToast } from "@/core/toast/ToastProvider";

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
  const toast = useToast();

  const { data: code, isLoading, isError, refetch } = useMyInviteCode(userId);
  const create = useCreateInviteCode(userId);

  const handleShare = async () => {
    try {
      // Se crea al pedirlo, no al abrir: navegar a un sitio no debería
      // escribir nada.
      const value = code ?? (await create.mutateAsync());
      const url = buildShareUrl(`/i/${value}`, "invitacion");

      const outcome = await shareOrCopy(t("invite.message"), url);

      // El tercer caso importa: en web, "copiado" y "compartido" son cosas
      // distintas y sin decirlo parece que no ha pasado nada.
      if (outcome === "copied") toast.success(t("share.linkCopied"));
      if (outcome === "failed") toast.error(t("share.shareFailed"));
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  };

  if (isLoading) {
    return <ScreenScaffold title={t("invite.title")} loading />;
  }

  if (isError) {
    return (
      <ScreenScaffold
        title={t("invite.title")}
        error
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <ScreenScaffold
      title={t("invite.title")}
      contentClassName="flex-grow gap-6"
    >
      <Txt variant="reading">{t("invite.body")}</Txt>

      {code ? (
        /* El enlace en una tarjeta con su rótulo, no una URL cruda flotando.
           Sigue seleccionable a mano: es lo que salva el día que la hoja del
           sistema falla o el portapapeles está capado. */
        <Card label={t("invite.linkLabel")}>
          <Txt variant="body" selectable>
            {buildShareUrl(`/i/${code}`, "invitacion")}
          </Txt>
        </Card>
      ) : null}

      <Button
        title={t("invite.cta")}
        loading={create.isPending}
        onPress={() => void handleShare()}
      />
    </ScreenScaffold>
  );
}
