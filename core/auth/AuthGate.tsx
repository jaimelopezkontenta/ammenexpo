import { Redirect, useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/Button";

import { useSession } from "./SessionProvider";

const Loading = () => (
  <View className="flex-1 items-center justify-center bg-white">
    <ActivityIndicator color="#0f172a" />
  </View>
);

/**
 * Routes on session + onboarding state.
 *
 * The `(public)` group is deliberately exempt: a shared prayer plan has to
 * render for someone who has no account yet, which is the entire acquisition
 * loop. Gating it behind auth would turn every shared link into a dead end.
 */
export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  const {
    session,
    isLoading,
    hasOnboarded,
    termsAccepted,
    onboardingFailed,
    refreshOnboarding,
    signOut,
  } = useSession();
  const segments = useSegments();
  const group = segments[0];

  if (group === "(public)") {
    return <>{children}</>;
  }

  // The one auth screen you arrive at *with* a session: the recovery link signs
  // you in and then asks for the new password. Sending it to "/" like the rest
  // of the group meant the password was never actually changed, so the next
  // sign-out locked the person out all over again.
  if (segments[1] === "nueva-contrasena") {
    return <>{children}</>;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (!session) {
    return group === "(auth)" ? <>{children}</> : <Redirect href="/entrar" />;
  }

  // A read that failed and gave up is not a read still in flight. Both left
  // `hasOnboarded` null, and the gate treated them the same: a spinner with no
  // text, no retry and no way out — the front door of the app, hanging forever,
  // for anyone whose profile is unreadable (a deleted account, an expired token
  // the client still believes in, a backend that is down at launch).
  if (onboardingFailed) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
        <Text
          className="text-center text-xl font-bold text-slate-900"
          accessibilityRole="alert"
        >
          {t("common.errorTitle")}
        </Text>
        <Text className="text-center text-base leading-6 text-slate-500">
          {t("common.errorBody")}
        </Text>
        <View className="mt-4 w-full gap-3">
          <Button
            title={t("common.retry")}
            onPress={() => void refreshOnboarding()}
          />
          {/* The escape hatch. If the session itself is the problem, retrying
              will never fix it, and signing out is the only door left. */}
          <Button
            title={t("auth.signOut")}
            variant="ghost"
            onPress={() => void signOut()}
          />
        </View>
      </View>
    );
  }

  // Onboarding state not resolved yet — routing now would flash the wrong screen.
  if (hasOnboarded === null || termsAccepted === null) {
    return <Loading />;
  }

  // Los términos van **antes que el onboarding**: ese pregunta qué estás
  // viviendo y por qué te gustaría orar, y pedir eso antes de decir qué hacemos
  // con lo que nos cuentas es el orden equivocado.
  //
  // Va como puerta y no como una casilla en el alta porque tiene que alcanzar a
  // quien ya tiene cuenta, y al día que el texto cambie: `termsAccepted` compara
  // versiones, así que subir `TERMS_VERSION` vuelve a preguntar una vez a todo
  // el mundo. `legal` se deja pasar para poder leer lo que se está aceptando.
  if (!termsAccepted) {
    return group === "aceptar" || group === "legal" ? (
      <>{children}</>
    ) : (
      <Redirect href="/aceptar" />
    );
  }

  if (!hasOnboarded) {
    return group === "(onboarding)" ? (
      <>{children}</>
    ) : (
      <Redirect href="/bienvenida" />
    );
  }

  // `aceptar` entra aquí por el mismo motivo que los otros dos: es una puerta,
  // y una puerta ya cruzada no puede seguir en pie. Sin esto, aceptar dejaba a
  // la persona mirando la misma pantalla que acababa de despachar —el gate ya
  // no la mandaba aquí, pero tampoco la sacaba—. `legal` no entra: los dos
  // documentos se leen cuando a uno le apetezca, también desde «Acerca de».
  if (group === "(auth)" || group === "(onboarding)" || group === "aceptar") {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
};
