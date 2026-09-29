import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { AuthForm } from "@/components/AuthForm";
import { AuthScreen } from "@/components/AuthScreen";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/ui/Text";
import {
  attachPendingTokensToProfile,
  attachSignupSource,
  readPendingTokens,
} from "@/core/auth/pendingToken";
import { resolveSignupSource } from "@/core/auth/signupSource";
import {
  MIN_PASSWORD_LENGTH,
  authErrorKey,
  isValidEmail,
} from "@/core/auth/validation";
import { track } from "@/core/observability/track";
import { useToast } from "@/core/toast/ToastProvider";
import { supabase } from "@/utils/supabase";

export default function SignUp() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"email" | "password" | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Los errores del formulario se quedan junto al campo (o debajo) hasta que
  // se corrigen; el «revisa tu correo» es un aviso que pasa, y va por el
  // toast del sistema.
  const toast = useToast();

  const handleSubmit = async () => {
    setError(null);
    setErrorField(null);

    if (!isValidEmail(email)) {
      setError(t("auth.emailInvalid"));
      setErrorField("email");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("auth.passwordTooShort"));
      setErrorField("password");
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
      // Y por dónde entró, que se escribe una sola vez y aquí: el registro es
      // el único momento en que «de dónde vino esta persona» significa algo.
      const { source } = await readPendingTokens();
      await attachSignupSource(data.user.id);
      track("signup", { source: resolveSignupSource(source) });
    } else {
      // Email confirmation is on: there is no session yet.
      toast.success(t("auth.checkEmail"));
    }

    setIsSubmitting(false);
  };

  return (
    <AuthScreen title={t("auth.signUpTitle")} intro={t("auth.signUpIntro")}>
      <AuthForm className="mt-8 gap-4">
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
          placeholder={t("auth.passwordPlaceholder")}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
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

        <Button
          title={t("auth.signUp")}
          onPress={handleSubmit}
          loading={isSubmitting}
        />
      </AuthForm>

      <View className="mt-8 flex-row items-center justify-center gap-2">
        <Txt variant="caption">{t("auth.hasAccount")}</Txt>
        <Link href="/entrar" className="font-sans-semibold text-plum">
          {t("auth.signIn")}
        </Link>
      </View>
    </AuthScreen>
  );
}
