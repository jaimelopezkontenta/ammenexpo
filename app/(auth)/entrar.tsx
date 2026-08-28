import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { AuthScreen } from "@/components/AuthScreen";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/ui/Text";
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

  // Sin la letra pequeña de "al entrar aceptas los términos" que lleva el
  // diseño: aquí los términos se piden en su propia pantalla, con su versión y
  // su registro, así que ese pie sería mentira.
  return (
    <AuthScreen title={t("auth.signInTitle")} intro={t("auth.signInIntro")}>
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
          <Txt variant="caption" tone="danger" accessibilityRole="alert">
            {error}
          </Txt>
        ) : null}

        {/* The key has been translated in both languages since the beginning
            with nothing behind it, so losing your password lost the account.
            Va **antes** del botón y alineado a la derecha, como en el diseño:
            es lo que se busca cuando la contraseña no entra, y debajo del CTA
            quedaba después del gesto que acaba de fallar. */}
        <Link
          href="/recuperar"
          className="-mt-1 self-end font-sans-medium text-sm text-ember-ink"
        >
          {t("auth.forgotPassword")}
        </Link>

        <Button
          title={t("auth.signIn")}
          onPress={handleSubmit}
          loading={isSubmitting}
        />
      </View>

      <View className="mt-8 flex-row items-center justify-center gap-2">
        <Txt variant="caption">{t("auth.noAccount")}</Txt>
        <Link href="/crear-cuenta" className="font-sans-semibold text-plum">
          {t("auth.signUp")}
        </Link>
      </View>
    </AuthScreen>
  );
}
