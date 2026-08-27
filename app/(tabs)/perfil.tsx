import * as Localization from "expo-localization";
import { Link, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, Text, View } from "react-native";

import { TabHeader } from "@/components/TabHeader";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ChoiceChips } from "@/components/ChoiceChips";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { ResponsiveTabContent } from "@/components/ResponsiveTabContent";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
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
import {
  useDeleteAccount,
  useProfile,
  useUpdateProfile,
  useUpdateTimezone,
} from "@/core/profile/queries";

import { NavRow } from "@/components/ui/NavRow";
import { Tap } from "@/components/ui/Tap";

export default function Profile() {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const userId = session?.user.id;

  const { data: profile, isLoading, isError, refetch } = useProfile(userId);
  const update = useUpdateProfile(userId);
  const updateTimezone = useUpdateTimezone(userId);
  const uploadAvatar = useUploadAvatar(userId);
  const removeAvatar = useRemoveAvatar(userId);
  const deleteAccount = useDeleteAccount();
  const { data: openReports } = useOpenReportCount(userId);

  // Null means "not edited", so the field simply shows whatever the server
  // holds. Seeding this from an effect instead would fight every refetch for
  // control of the text somebody is in the middle of typing.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftHours, setDraftHours] = useState<number[] | null>(null);
  // Resultados de acción por el toast del sistema: caducan solos y no
  // empujan el layout justo cuando la app dice "guardado".
  const toast = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (isLoading) {
    return <LoadingState skeleton="profile" />;
  }

  if (isError || !profile) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const name = draftName ?? profile.display_name;
  const hours = draftHours ?? profile.reminder_hours;
  // Content, not reference: `draftHours !== profile.reminder_hours` is true for
  // two arrays holding the same numbers, so every render would look dirty.
  const sameHours =
    hours.length === profile.reminder_hours.length &&
    hours.every((entry) => profile.reminder_hours.includes(entry));
  const dirty = name.trim() !== profile.display_name || !sameHours;

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

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        displayName: name.trim() !== profile.display_name ? name : undefined,
        reminderHours: sameHours ? undefined : hours,
      });

      setDraftName(null);
      setDraftHours(null);
      toast.success(t("profile.saved"));
    } catch {
      toast.error(t("common.errorGeneric"));
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
                <Text className="font-sans-bold text-2xl text-plum">
                  {profile.display_name}
                </Text>
                {session?.user.email ? (
                  <Text className="font-sans text-sm text-mist-ink">
                    {session.user.email}
                  </Text>
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
                    <Text className="font-sans text-sm text-mist-ink underline">
                      {profile.avatar_url
                        ? t("profile.changePhoto")
                        : t("profile.addPhoto")}
                    </Text>
                  </Tap>

                  {profile.avatar_url ? (
                    <Tap
                      accessibilityRole="button"
                      disabled={removeAvatar.isPending}
                      onPress={() => void handleRemovePhoto()}
                      hitSlop={12}
                    >
                      <Text className="font-sans text-sm text-mist-ink underline">
                        {t("profile.removePhoto")}
                      </Text>
                    </Tap>
                  ) : null}
                </View>
              </View>
            </View>

            <TextField
              label={t("profile.name")}
              value={name}
              onChangeText={setDraftName}
              maxLength={80}
            />
          </Card>

          {/* Un único guardado para nombre y recordatorios. Aquí queda junto al
            campo de nombre, en vez de aparecer al final de Preferencias. */}
          {dirty ? (
            <View className="w-full md:max-w-sm">
              <Button
                title={t("common.save")}
                loading={update.isPending}
                onPress={() => void handleSave()}
              />
            </View>
          ) : null}

          <View className="gap-6 md:flex-row md:items-start">
            <Card
              label={t("profile.preferences")}
              className="gap-6 md:min-w-0 md:flex-1"
            >
              <View className="gap-3">
                <Text className="font-sans-medium text-sm text-mist-ink">
                  {t("profile.reminder")}
                </Text>
                <ChoiceChips
                  options={REMINDER_HOURS.map((slot) => ({
                    value: String(slot.hour),
                    label: t(`onboarding.hours.${slot.key}`),
                  }))}
                  selected={hours.map(String)}
                  onToggle={(value) =>
                    setDraftHours(
                      toggleWithLimit(
                        hours.map(String),
                        value,
                        REMINDER_MAX,
                      ).map(Number),
                    )
                  }
                  max={REMINDER_MAX}
                  multiple
                />
                {/* En nativo estas horas se programan como notificaciones
                  locales diarias al guardar (ver localReminders.ts); en web no
                  se puede programar nada, y el copy lo dice sin fingir que va
                  a sonar. */}
                <Text className="font-sans text-sm leading-5 text-mist-ink">
                  {Platform.OS === "web"
                    ? t("profile.reminderHintWeb")
                    : t("profile.reminderHintNative")}
                </Text>
              </View>

              <View className="gap-2">
                <Text className="font-sans-medium text-sm text-mist-ink">
                  {t("profile.timezone")}
                </Text>
                <Text className="font-sans text-base text-plum">
                  {profile.timezone}
                </Text>
                <Text className="font-sans text-sm text-mist-ink">
                  {t("profile.timezoneHint")}
                </Text>

                {zoneMoved ? (
                  <View className="gap-2 pt-1">
                    <Text className="font-sans text-sm text-mist-ink">
                      {t("profile.timezoneMoved", { zone: deviceZone })}
                    </Text>
                    <Button
                      title={t("profile.timezoneUpdate", { zone: deviceZone })}
                      variant="secondary"
                      loading={updateTimezone.isPending}
                      onPress={() => void handleTimezone()}
                    />
                  </View>
                ) : null}
              </View>

              <LanguageSwitcher />
            </Card>

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

                <Link href="/acerca" asChild>
                  <NavRow label={t("profile.about")} />
                </Link>
              </Card>

              <Card label={t("profile.dangerZone")} className="gap-3">
                <Button
                  title={t("auth.signOut")}
                  variant="secondary"
                  loading={signingOut}
                  onPress={() => void handleSignOut()}
                />

                {confirmingDelete ? (
                  <Text
                    className="text-center font-sans text-sm text-danger"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {t("profile.deleteWarning")}
                  </Text>
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
