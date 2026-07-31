import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { MIN_PASSWORD_LENGTH } from "@/core/auth/validation";
import { supabase } from "@/utils/supabase";

/**
 * Where the recovery link lands.
 *
 * Supabase has already turned the link into a session by the time this renders,
 * so there is no token to handle here — just a new password to set. If someone
 * opens this route without coming from a link, `updateUser` fails and says so
 * rather than pretending to have worked.
 */
export default function NewPassword() {
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.passwordTooShort"));
      return;
    }

    setIsSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setIsSubmitting(false);

    if (updateError) {
      setError(t("auth.recoverExpired"));
      return;
    }

    router.replace("/");
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-7 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="text-3xl font-bold text-slate-900">
            {t("auth.newPasswordTitle")}
          </Text>
          <Text className="text-base leading-6 text-slate-500">
            {t("auth.newPasswordBody")}
          </Text>
        </View>

        <View className="mt-8 gap-4">
          <TextField
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            error={error}
            placeholder={t("auth.passwordPlaceholder")}
            secureTextEntry
            autoComplete="new-password"
          />

          <Button
            title={t("common.save")}
            loading={isSubmitting}
            onPress={() => void handleSubmit()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
