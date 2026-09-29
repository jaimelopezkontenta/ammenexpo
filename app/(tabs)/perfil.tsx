import * as Localization from "expo-localization";
import { Link, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform, ScrollView, View } from "react-native";

import { TabHeader } from "@/components/TabHeader";
import { Txt } from "@/components/ui/Text";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ChoiceChips } from "@/components/ChoiceChips";
import { ExportData } from "@/components/ExportData";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import { usePushPermissionStatus } from "@/core/notifications/push";
import {
  AvatarTooLarge,
  useRemoveAvatar,
  useUploadAvatar,
} from "@/core/profile/avatar";
import {
  REMINDER_HOURS,
  REMINDER_MAX,
  toggleWithLimit,
} from "@/core/onboarding/options";
import { useOpenReportCount } from "@/core/moderation/queue";
import { useToast } from "@/core/toast/ToastProvider";
import { useAction } from "@/core/toast/useAction";
import { useEmailPreferences } from "@/core/email/queries";
import { createDebouncedSaver, sameHours } from "@/core/profile/autosave";
import {
  useDeleteAccount,
  useProfile,
  useUpdateProfile,
  useUpdateTimezone,
} from "@/core/profile/queries";

import { NavRow } from "@/components/ui/NavRow";
import { Tap } from "@/components/ui/Tap";

// Si esta pestaña revienta, las demás y la barra siguen en pie.
export { AppErrorBoundary as ErrorBoundary } from "@/components/AppErrorBoundary";

export default function Profile() {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const userId = session?.user.id;

  const {
    data: profile,
    isLoading,
    isLoadingError,
    error,
    refetch,
  } = useProfile(userId);
  const { data: emailPrefs } = useEmailPreferences(userId);
  const update = useUpdateProfile(userId);
  const updateTimezone = useUpdateTimezone(userId);
  const uploadAvatar = useUploadAvatar(userId);
  const removeAvatar = useRemoveAvatar(userId);
  const deleteAccount = useDeleteAccount();
  const { data: pushPermission } = usePushPermissionStatus();
  const { data: openReports } = useOpenReportCount(userId);

  // Null means "not edited", so the field simply shows whatever the server
  // holds. Seeding this from an effect instead would fight every refetch for
  // control of the text somebody is in the middle of typing.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftHours, setDraftHours] = useState<number[] | null>(null);
  // Resultados de acción por el toast del sistema: caducan solos y no
  // empujan el layout justo cuando la app dice "guardado".
  const toast = useToast();
  const { run: save } = useAction();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // El nombre que ya va de camino al servidor: al pulsar Intro llegan
  // `onSubmitEditing` y `onBlur` seguidos, y sin esto se guardaba dos veces.
  const nameInFlight = useRef<string | null>(null);

  // Las horas se guardan al elegirlas, con un respiro: tres toques seguidos
  // son un guardado y un solo «Guardado.». El ahorrador se crea una vez y en
  // cada render se le da el guardado con lo último que ve el componente.
  const [hoursSaver] = useState(() =>
    createDebouncedSaver<number[]>(() => undefined, 700),
  );
  const serverHours = profile?.reminder_hours;

  useEffect(() => {
    hoursSaver.setSave((next) => {
      // Volver a lo de siempre antes de que salte el guardado no es un cambio:
      // ni petición ni «Guardado.» de mentira.
      if (serverHours && sameHours(next, serverHours)) {
        setDraftHours(null);
        return;
      }

      void save(
        () => update.mutateAsync({ reminderHours: next }),
        t("profile.saved"),
      ).then((ok) => {
        // Solo se suelta el borrador si nadie ha vuelto a tocar las horas
        // mientras tanto.
        if (ok)
          setDraftHours((cur) => (cur && sameHours(cur, next) ? null : cur));
      });
    });
  });

  // Si la pantalla se va con un toque pendiente, se guarda ya en vez de
  // perderlo.
  useEffect(() => () => hoursSaver.flush(), [hoursSaver]);

  if (isLoading) {
    return <LoadingState skeleton="profile" />;
  }

  if (isLoadingError || !profile) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const name = draftName ?? profile.display_name;
  const hours = draftHours ?? profile.reminder_hours;

  // La zona horaria se escribía **una sola vez**, en el onboarding, y decide
  // cuándo se abre tu día y cuándo cuenta tu racha: quien se mudaba de país no
  // tenía forma de arreglarlo desde ninguna pantalla.
  //
  // Sin selector de las cuatrocientas zonas IANA. El caso real es "me he
  // mudado", y para eso basta con comparar la guardada con la que dice el
  // dispositivo y ofrecer el cambio solo cuando difieren; una lista de
  // cuatrocientas entradas es sobre todo una forma de elegir mal.
  const deviceZone = Localization.getCalendars()[0]?.timeZone ?? null;
  const zoneMoved = Boolean(deviceZone) && deviceZone !== profile.timezone;

  const handleTimezone = async () => {
    if (!deviceZone) return;

    try {
      await updateTimezone.mutateAsync(deviceZone);
      toast.success(t("profile.saved"));
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  };

  const handlePickPhoto = async () => {
    try {
      const url = await uploadAvatar.mutateAsync();
      // `null` significa que cerró el selector sin elegir nada, que no es un
      // fallo y tampoco merece un "guardado".
      if (url) toast.success(t("profile.saved"));
    } catch (caught) {
      // Los dos motivos que la persona puede arreglar se dicen por su nombre;
      // el resto cae en el genérico.
      toast.error(
        caught instanceof AvatarTooLarge
          ? t("profile.photoTooLarge")
          : (caught as Error)?.message === "avatar_permission_denied"
            ? t("profile.photoDenied")
            : t("common.errorGeneric"),
      );
    }
  };

  const handleRemovePhoto = async () => {
    try {
      await removeAvatar.mutateAsync();
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  };

  // El nombre se guarda al terminar de editarlo (salir del campo o Intro), no
  // con un botón que aparecía lejos de él: tema, idioma y horas ya guardaban al
  // instante, y una pantalla con dos modelos de guardado deja dudando de qué
  // se ha guardado.
  const commitName = async () => {
    const next = name.trim();

    // Un nombre vacío no se guarda: el campo vuelve al de siempre.
    if (!next || next === profile.display_name) {
      setDraftName(null);
      return;
    }

    if (nameInFlight.current === next) return;
    nameInFlight.current = next;

    const ok = await save(
      () => update.mutateAsync({ displayName: next }),
      t("profile.saved"),
    );

    nameInFlight.current = null;
    // Si falla, el borrador se queda: el toast lo dice y salir del campo otra
    // vez lo reintenta.
    if (ok) {
      setDraftName((cur) => (cur !== null && cur.trim() === next ? null : cur));
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      setSigningOut(false);
    }
  };

  const handleDelete = async () => {
    // Two taps, and the second one is red: this takes the plans, the circles
    // and everything anyone ever prayed, and none of it comes back.
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    try {
      await deleteAccount.mutateAsync();
      router.replace("/entrar");
    } catch {
      setConfirmingDelete(false);
      toast.error(t("common.errorGeneric"));
    }
  };

  return (
    <KeyboardScreen>
      <DawnBackground>
        <TabHeader title={t("tabs.profile")} />
        <ScrollView
          contentContainerClassName="flex-grow py-10"
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveTabContent className="gap-6">
            <Card label={t("profile.identity")} className="gap-6">
              {/* La cara primero: `avatar_url` viajaba en trece RPC desde la Fase
              1 y no se pintaba en ningún sitio. */}
              <View className="flex-row items-center gap-4">
                <Avatar
                  name={profile.display_name}
                  url={profile.avatar_url}
                  seed={userId}
                  size={72}
                />

                <View className="min-w-0 flex-1 gap-1">
                  <Txt variant="headingLg">{profile.display_name}</Txt>
                  {session?.user.email ? (
                    <Txt variant="caption" accessibilityLiveRegion="polite">
                      {t("profile.signedIn", { email: session.user.email })}
                    </Txt>
                  ) : null}

                  <View className="flex-row flex-wrap gap-4 pt-1">
                    <Tap
                      accessibilityRole="button"
                      disabled={uploadAvatar.isPending}
                      onPress={() => void handlePickPhoto()}
                      // Enlaces de 14px: sin esto la zona táctil quedaba por
                      // debajo de los 44px mínimos.
                      hitSlop={12}
                    >
                      <Txt variant="caption" className="underline">
                        {profile.avatar_url
                          ? t("profile.changePhoto")
                          : t("profile.addPhoto")}
                      </Txt>
                    </Tap>

                    {profile.avatar_url ? (
                      <Tap
                        accessibilityRole="button"
                        disabled={removeAvatar.isPending}
                        onPress={() => void handleRemovePhoto()}
                        hitSlop={12}
                      >
                        <Txt variant="caption" className="underline">
                          {t("profile.removePhoto")}
                        </Txt>
                      </Tap>
                    ) : null}
                  </View>
                </View>
              </View>

              <TextField
                label={t("profile.name")}
                value={name}
                onChangeText={setDraftName}
                onBlur={() => void commitName()}
                onSubmitEditing={() => void commitName()}
                returnKeyType="done"
                maxLength={80}
              />
            </Card>

            <View className="gap-6 md:flex-row md:items-start">
              <View className="gap-6 md:min-w-0 md:flex-1">
                <Card label={t("profile.appearance")} className="gap-3">
                  <ThemeSwitcher />
                </Card>
                <Card label={t("profile.preferences")} className="gap-6">
                  <View className="gap-3">
                    <Txt variant="label" tone="secondary">
                      {t("profile.reminder")}
                    </Txt>
                    <ChoiceChips
                      options={REMINDER_HOURS.map((slot) => ({
                        value: String(slot.hour),
                        label: t(`onboarding.hours.${slot.key}`),
                      }))}
                      selected={hours.map(String)}
                      onToggle={(value) => {
                        const next = toggleWithLimit(
                          hours.map(String),
                          value,
                          REMINDER_MAX,
                        ).map(Number);

                        setDraftHours(next);
                        hoursSaver.schedule(next);
                      }}
                      max={REMINDER_MAX}
                      multiple
                    />
                    {/* En nativo estas horas se programan como notificaciones
                  locales diarias al guardar (ver localReminders.ts); en web no
                  se puede programar nada, y el copy lo dice sin fingir que va
                  a sonar. */}
                    <Txt variant="caption">
                      {Platform.OS === "web"
                        ? t("profile.reminderHintWeb")
                        : t("profile.reminderHintNative")}
                    </Txt>
                    {/* Denegado el permiso, las horas no sirven de nada y nadie
                      lo decía: se dice, y se ofrece el camino a los ajustes. */}
                    {pushPermission === "denied" ? (
                      <View className="gap-2">
                        <Txt variant="caption" tone="danger">
                          {t("profile.reminderDenied")}
                        </Txt>
                        <Button
                          title={t("profile.openSettings")}
                          variant="secondary"
                          onPress={() => void Linking.openSettings()}
                        />
                      </View>
                    ) : null}
                  </View>

                  <View className="gap-2">
                    <Txt variant="label" tone="secondary">
                      {t("profile.timezone")}
                    </Txt>
                    <Txt variant="body">{profile.timezone}</Txt>
                    <Txt variant="caption">{t("profile.timezoneHint")}</Txt>

                    {zoneMoved ? (
                      <View className="gap-2 pt-1">
                        <Txt variant="caption">
                          {t("profile.timezoneMoved", { zone: deviceZone })}
                        </Txt>
                        <Button
                          title={t("profile.timezoneUpdate", {
                            zone: deviceZone,
                          })}
                          variant="secondary"
                          loading={updateTimezone.isPending}
                          onPress={() => void handleTimezone()}
                        />
                      </View>
                    ) : null}
                  </View>

                  <LanguageSwitcher />
                </Card>
              </View>

              <View className="gap-6 md:min-w-0 md:flex-1">
                {/* Filas con chevron, no seis Button ghost idénticos: son
                enlaces a otra pantalla, no seis llamadas a la acción del
                mismo peso. */}
                <Card label={t("profile.communitySupport")} className="gap-0">
                  <Link href="/testimonios" asChild>
                    <NavRow label={t("testimony.title")} />
                  </Link>

                  {/* Plus es una página informativa: el nombre deja claro aquí,
                  antes de abrirla, que todavía no existe una compra. */}
                  <Link href="/plus" asChild>
                    <NavRow label={t("profile.plusComingSoon")} />
                  </Link>

                  <Link href="/bloqueados" asChild>
                    <NavRow label={t("moderation.blockedTitle")} />
                  </Link>

                  {profile.is_staff ? (
                    <Link href="/moderacion" asChild>
                      <NavRow
                        label={
                          openReports
                            ? `${t("moderation.queueTitle")} · ${openReports}`
                            : t("moderation.queueTitle")
                        }
                      />
                    </Link>
                  ) : null}

                  <Link href="/invitar" asChild>
                    <NavRow label={t("invite.title")} />
                  </Link>

                  <Link href="/correo" asChild>
                    <NavRow
                      label={t("email.title")}
                      meta={
                        emailPrefs
                          ? t(`email.cadence.${emailPrefs.cadence}`)
                          : undefined
                      }
                    />
                  </Link>

                  <Link href="/acerca" asChild>
                    <NavRow label={t("profile.about")} />
                  </Link>
                </Card>

                {/* Tus datos, a la vista: el derecho de acceso no puede estar
                escondido dentro de «Acerca de». Una tarjeta propia, ni con
                el soporte ni en la zona de peligro: exportar no rompe nada. */}
                <Card label={t("profile.dataZone")} className="gap-3">
                  <ExportData />
                </Card>

                <Card label={t("profile.dangerZone")} className="gap-3">
                  <Button
                    title={t("auth.signOut")}
                    variant="secondary"
                    loading={signingOut}
                    onPress={() => void handleSignOut()}
                  />

                  {confirmingDelete ? (
                    <Txt
                      variant="caption"
                      tone="danger"
                      className="text-center"
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                    >
                      {t("profile.deleteWarning")}
                    </Txt>
                  ) : null}

                  <Button
                    title={
                      confirmingDelete
                        ? t("profile.deleteConfirm")
                        : t("profile.delete")
                    }
                    variant="ghost"
                    loading={deleteAccount.isPending}
                    onPress={() => void handleDelete()}
                  />
                </Card>
              </View>
            </View>
          </ResponsiveTabContent>
        </ScrollView>
      </DawnBackground>
    </KeyboardScreen>
  );
}
