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
import { attachPendingTokensToProfile } from "@/core/auth/pendingToken";
import {
  MIN_PASSWORD_LENGTH,
  authErrorKey,
  isValidEmail,
} from "@/core/auth/validation";
import { supabase } from "@/utils/supabase";

export default function SignUp() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setNotice(null);

    if (!isValidEmail(email)) {
      setError(t("auth.emailInvalid"));
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.passwordTooShort"));
      return;
    }

    setIsSubmitting(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setIsSubmitting(false);
      setError(t(authErrorKey(signUpError.message)));
      return;
    }

    if (data.session && data.user) {
      // Carry over the share link or invite that brought this person here, so
      // onboarding can redeem it and actually connect them to the inviter.
      await attachPendingTokensToProfile(data.user.id);
    } else {
      // Email confirmation is on: there is no session yet.
      setNotice(t("auth.checkEmail"));
    }

    setIsSubmitting(false);
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
            {t("auth.signUpTitle")}
          </Text>
          <Text className="text-base text-slate-500">
            {t("auth.signUpIntro")}
          </Text>
        </View>

        <View className="mt-8 gap-4">
          <TextField
            label={t("auth.email")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextField
            label={t("auth.password")}
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.passwordPlaceholder")}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />

          {error ? (
            <Text className="text-sm text-red-500" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {notice ? (
            <Text className="text-sm text-slate-600" accessibilityRole="alert">
              {notice}
            </Text>
          ) : null}

          <Button
            title={t("auth.signUp")}
            onPress={handleSubmit}
            loading={isSubmitting}
          />
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-2">
          <Text className="text-slate-500">{t("auth.hasAccount")}</Text>
          <Link href="/entrar" className="font-semibold text-slate-900">
            {t("auth.signIn")}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
