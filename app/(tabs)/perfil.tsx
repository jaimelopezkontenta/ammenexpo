import { router } from "expo-router";
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
  useDeleteAccount,
  useProfile,
  useUpdateProfile,
} from "@/core/profile/queries";

/** The same hours and keys the onboarding offers, so the two screens agree. */
const REMINDER_HOURS = [
  { key: "early", hour: 6 },
  { key: "morning", hour: 8 },
  { key: "noon", hour: 12 },
  { key: "evening", hour: 18 },
  { key: "night", hour: 21 },
];

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
  const [draftHour, setDraftHour] = useState<number | null>(null);
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
  const hour = draftHour ?? profile.reminder_hour;
  const dirty =
    name.trim() !== profile.display_name || hour !== profile.reminder_hour;

  const handleSave = async () => {
    setNotice(null);
    setError(null);

    try {
      await update.mutateAsync({
        displayName: name.trim() !== profile.display_name ? name : undefined,
        reminderHour: hour !== profile.reminder_hour ? hour : undefined,
      });

      setDraftName(null);
      setDraftHour(null);
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
      className="flex-1 bg-white"
      contentContainerClassName="flex-grow gap-8 px-7 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-2xl font-bold text-slate-900">
          {t("profile.title")}
        </Text>
        {session?.user.email ? (
          <Text className="text-sm text-slate-400">{session.user.email}</Text>
        ) : null}
      </View>

      <TextField
        label={t("profile.name")}
        value={name}
        onChangeText={setDraftName}
        maxLength={80}
      />

      <View className="gap-3">
        <Text className="text-sm font-medium text-slate-600">
          {t("profile.reminder")}
        </Text>
        <ChoiceChips
          options={REMINDER_HOURS.map((slot) => ({
            value: String(slot.hour),
            label: t(`onboarding.hours.${slot.key}`),
          }))}
          selected={[String(hour)]}
          onToggle={(value) => setDraftHour(Number(value))}
        />
        {/* Honest about what it does today: the hour is stored and nothing
            reads it until push exists. */}
        <Text className="text-sm text-slate-500">
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
        <Text className="text-sm text-slate-600" accessibilityRole="alert">
          {notice}
        </Text>
      ) : null}

      {error ? (
        <Text className="text-sm text-red-500" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <LanguageSwitcher />

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
