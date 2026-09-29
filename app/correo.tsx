import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ChoiceChips } from "@/components/ChoiceChips";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { ToggleRow } from "@/components/ui/ToggleRow";
import { Txt } from "@/components/ui/Text";
import { useSession } from "@/core/auth/SessionProvider";
import {
  EMAIL_CADENCES,
  type EmailCadence,
  type EmailPreferences,
} from "@/core/email/cadence";
import {
  useEmailPreferences,
  useEmailPreferencesByToken,
  useReactivateEmailCadence,
  useUpdateEmailPreferences,
  useUpdateEmailPreferencesByToken,
} from "@/core/email/queries";
import { useToast } from "@/core/toast/ToastProvider";

const emptyPrefs = (): EmailPreferences => ({
  cadence: "daily",
  social: true,
  nudge: true,
});

/**
 * Preferencias de correo. Con sesión, desde Perfil (stack raíz, como Invitar:
 * Atrás vuelve a la pestaña). Sin sesión, con el token firmado del pie del
 * mail — AuthGate deja pasar `/correo?t=` igual que `/nueva-contrasena`.
 */
export default function Correo() {
  const { t } = useTranslation();
  const toast = useToast();
  const { session } = useSession();
  const params = useLocalSearchParams<{ t?: string; reactivate?: string }>();
  const token = typeof params.t === "string" ? params.t : undefined;
  const userId = session?.user.id;

  const signedIn = useEmailPreferences(userId);
  const byToken = useEmailPreferencesByToken(userId ? undefined : token);
  const updateSignedIn = useUpdateEmailPreferences(userId);
  const updateByToken = useUpdateEmailPreferencesByToken(token);
  const reactivate = useReactivateEmailCadence(token);

  const source = userId ? signedIn : byToken;
  const server = source.data ?? null;

  const [draft, setDraft] = useState<EmailPreferences | null>(null);
  const prefs = draft ?? server ?? emptyPrefs();

  const canEdit = Boolean(userId || token);
  const dirty =
    server !== null &&
    (prefs.cadence !== server.cadence ||
      prefs.social !== server.social ||
      prefs.nudge !== server.nudge);

  useEffect(() => {
    if (!token || params.reactivate !== "1") return;
    void reactivate.mutateAsync().catch(() => {
      toast.error(t("common.errorGeneric"));
    });
    // Una vez por montaje con este token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, params.reactivate]);

  const handleSave = async () => {
    try {
      if (userId) {
        await updateSignedIn.mutateAsync(prefs);
      } else if (token) {
        await updateByToken.mutateAsync(prefs);
      } else {
        return;
      }
      setDraft(null);
      toast.success(t("profile.saved"));
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  };

  if (!canEdit) {
    return (
      <ScreenScaffold
        title={t("email.title")}
        error
        errorMessage={t("email.tokenMissing")}
      />
    );
  }

  if (source.isLoading) {
    return (
      <ScreenScaffold title={t("email.title")} loading skeleton="profile" />
    );
  }

  if (source.isLoadingError || !server) {
    return (
      <ScreenScaffold
        title={t("email.title")}
        error
        onRetry={() => void source.refetch()}
        errorMessage={token ? t("email.tokenInvalid") : undefined}
      />
    );
  }

  return (
    <ScreenScaffold title={t("email.title")} contentClassName="flex-grow gap-6">
      <Card label={t("email.verseCard")} className="gap-4">
        <Txt variant="label">{t("email.cadenceQuestion")}</Txt>
        <ChoiceChips
          options={EMAIL_CADENCES.map((value) => ({
            value,
            label: t(`email.cadence.${value}`),
          }))}
          selected={[prefs.cadence]}
          onToggle={(value) =>
            setDraft({ ...prefs, cadence: value as EmailCadence })
          }
        />
        <Txt variant="caption">{t("email.cadenceHint")}</Txt>
      </Card>

      <Card label={t("email.togetherCard")} className="gap-2">
        <ToggleRow
          title={t("email.socialTitle")}
          caption={t("email.socialHint")}
          value={prefs.social}
          onToggle={(social) => setDraft({ ...prefs, social })}
        />
      </Card>

      <Card label={t("email.nudgeCard")} className="gap-2">
        <ToggleRow
          title={t("email.nudgeTitle")}
          caption={t("email.nudgeHint")}
          value={prefs.nudge}
          onToggle={(nudge) => setDraft({ ...prefs, nudge })}
        />
      </Card>

      <Txt variant="caption">{t("email.accountAlways")}</Txt>

      {userId ? (
        <Link
          href={{ pathname: "/legal/[doc]", params: { doc: "privacidad" } }}
        >
          <Txt variant="caption" className="underline">
            {t("email.privacyLink")}
          </Txt>
        </Link>
      ) : (
        <Txt variant="caption">{t("email.privacyCaption")}</Txt>
      )}

      {dirty ? (
        <View className="pt-2">
          <Button
            title={t("common.save")}
            loading={updateSignedIn.isPending || updateByToken.isPending}
            onPress={() => void handleSave()}
          />
        </View>
      ) : null}
    </ScreenScaffold>
  );
}
