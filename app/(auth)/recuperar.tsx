import { Link } from "expo-router";
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
import { isValidEmail } from "@/core/auth/validation";
import { appUrl } from "@/core/share";
import { supabase } from "@/utils/supabase";

/**
 * Losing your password used to mean losing the account: the key existed,
 * translated in both languages, and there was no screen behind it.
 */
export default function RecoverPassword() {
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!isValidEmail(email)) {
      setError(t("auth.emailInvalid"));
      return;
    }

    setIsSubmitting(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${appUrl()}/nueva-contrasena` },
    );

    setIsSubmitting(false);

    if (resetError) {
      setError(t("common.errorGeneric"));
      return;
    }

    // Deliberately the same answer whether or not the address has an account:
    // otherwise this screen tells a stranger who is registered.
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-7 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="text-3xl font-bold text-ink">
            {t("auth.recoverTitle")}
          </Text>
          <Text className="text-base leading-6 text-ink-muted">
            {sent ? t("auth.recoverSentBody") : t("auth.recoverBody")}
          </Text>
        </View>

        {sent ? (
          <View className="mt-8 gap-3">
            <Link href="/entrar" asChild>
              <Button title={t("auth.signIn")} />
            </Link>
          </View>
        ) : (
          <View className="mt-8 gap-4">
            <TextField
              label={t("auth.email")}
              value={email}
              onChangeText={setEmail}
              error={error}
              placeholder={t("auth.emailPlaceholder")}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />

            <Button
              title={t("auth.recoverCta")}
              loading={isSubmitting}
              onPress={() => void handleSubmit()}
            />

            <Link href="/entrar" asChild>
              <Button title={t("common.back")} variant="ghost" />
            </Link>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
