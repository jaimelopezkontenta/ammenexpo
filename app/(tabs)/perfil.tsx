import { Link, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import {
  REMINDER_HOURS,
  REMINDER_MAX,
  toggleWithLimit,
} from "@/core/onboarding/options";
import {
  useDeleteAccount,
  useProfile,
  useUpdateProfile,
} from "@/core/profile/queries";

export default function Profile() {
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const userId = session?.user.id;

  const { data: profile, isLoading, isError, refetch } = useProfile(userId);
  const update = useUpdateProfile(userId);
  const deleteAccount = useDeleteAccount();

  // Null means "not edited", so the field simply shows whatever the server
  // holds. Seeding this from an effect instead would fight every refetch for
  // control of the text somebody is in the middle of typing.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftHours, setDraftHours] = useState<number[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (isLoading) {
    return <LoadingState />;
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

  const handleSave = async () => {
    setNotice(null);
    setError(null);

    try {
      await update.mutateAsync({
        displayName: name.trim() !== profile.display_name ? name : undefined,
        reminderHours: sameHours ? undefined : hours,
      });

      setDraftName(null);
      setDraftHours(null);
      setNotice(t("profile.saved"));
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  const handleDelete = async () => {
    // Two taps, and the second one is red: this takes the plans, the circles
    // and everything anyone ever prayed, and none of it comes back.
    if (!confirmingDelete) {
      setNotice(null);
      setError(null);
      setConfirmingDelete(true);
      return;
    }

    setError(null);

    try {
      await deleteAccount.mutateAsync();
      router.replace("/entrar");
    } catch {
      setConfirmingDelete(false);
      setError(t("common.errorGeneric"));
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="flex-grow gap-8 px-7 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-2xl font-bold text-ink">
          {t("profile.title")}
        </Text>
        {session?.user.email ? (
          <Text className="text-sm text-ink-soft">{session.user.email}</Text>
        ) : null}
      </View>

      <TextField
        label={t("profile.name")}
        value={name}
        onChangeText={setDraftName}
        maxLength={80}
      />

      <View className="gap-3">
        <Text className="text-sm font-medium text-ink-muted">
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
              toggleWithLimit(hours.map(String), value, REMINDER_MAX).map(
                Number,
              ),
            )
          }
          max={REMINDER_MAX}
          multiple
        />
        {/* Honest about what it does today: the hour is stored and nothing
            reads it until push exists. */}
        <Text className="text-sm text-ink-muted">
          {t("profile.reminderHint")}
        </Text>
      </View>

      {dirty ? (
        <Button
          title={t("common.save")}
          loading={update.isPending}
          onPress={() => void handleSave()}
        />
      ) : null}

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

      <LanguageSwitcher />

      {/* Blocking happens in the moment, from a message or from a roster. The
          undo has to live somewhere calm, and this is the only screen that
          belongs to you rather than to a circle. */}
      <Link href="/testimonios" asChild>
        <Button title={t("testimony.title")} variant="ghost" />
      </Link>

      <Link href="/plus" asChild>
        <Button title={t("profile.plus")} variant="ghost" />
      </Link>

      <Link href="/bloqueados" asChild>
        <Button title={t("moderation.blockedTitle")} variant="ghost" />
      </Link>

      <View className="mt-auto gap-3 pt-6">
        <Button
          title={t("auth.signOut")}
          variant="secondary"
          onPress={() => void signOut()}
        />

        {confirmingDelete ? (
          <Text
            className="text-center text-sm text-red-500"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {t("profile.deleteWarning")}
          </Text>
        ) : null}

        <Button
          title={
            confirmingDelete ? t("profile.deleteConfirm") : t("profile.delete")
          }
          variant="ghost"
          loading={deleteAccount.isPending}
          onPress={() => void handleDelete()}
        />
      </View>
    </ScrollView>
  );
}
