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
import { authErrorKey, isValidEmail } from "@/core/auth/validation";
import { supabase } from "@/utils/supabase";

export default function SignIn() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"email" | "password" | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setErrorField(null);

    if (!isValidEmail(email)) {
      setError(t("auth.emailInvalid"));
      setErrorField("email");
      return;
    }

    if (!password) {
      setError(t("auth.invalidCredentials"));
      return;
    }

    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(t(authErrorKey(signInError.message)));
    }
    // On success the session listener routes away from this screen.
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
            {t("auth.signInTitle")}
          </Text>
          <Text className="text-base text-slate-500">
            {t("auth.signInIntro")}
          </Text>
        </View>

        <View className="mt-8 gap-4">
          <TextField
            label={t("auth.email")}
            error={errorField === "email" ? error : null}
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
            error={errorField === "password" ? error : null}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />

          {/* Only errors that belong to no single field stay here; the rest
              are rendered by the field itself, so a screen reader hears which
              one is wrong. */}
          {error && !errorField ? (
            <Text className="text-sm text-red-500" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            title={t("auth.signIn")}
            onPress={handleSubmit}
            loading={isSubmitting}
          />
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-2">
          <Text className="text-slate-500">{t("auth.noAccount")}</Text>
          <Link href="/crear-cuenta" className="font-semibold text-slate-900">
            {t("auth.signUp")}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
