import { Redirect, useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { DawnBackground } from "@/components/DawnBackground";
import { Orb } from "@/components/Orb";
import { Wordmark } from "@/components/Wordmark";

import { useSession } from "./SessionProvider";

// Esta pantalla se quedó con los grises del scaffold hasta el rediseño, y no por
// descuido: vive en `core/`, que Tailwind no escaneaba, así que cualquier clase
// del tema que se escribiera aquí no llegaba a generarse nunca. Ahora `core/**`
// entra en `content` y la pantalla puede usar lo mismo que las demás.
//
// **Este es el splash de la app**, y no una pantalla aparte con un toque para
// continuar como en el prototipo. Es el sitio donde ya se esperaba —mientras se
// resuelven la sesión y el onboarding— así que poner aquí el orbe no le añade
// un segundo a nadie: cambia un spinner por la marca durante una espera que ya
// existía. Una pantalla de bienvenida que hay que despachar es tiempo cobrado
// al usuario a cambio de nada.
const Loading = () => {
  const { t } = useTranslation();

  return (
    <DawnBackground
      className="items-center justify-center"
      accessibilityRole="progressbar"
      // El orbe se esconde de la accesibilidad —es una marca—, así que sin esto
      // la pantalla de arranque se anunciaría vacía.
      accessibilityLabel={t("common.loading")}
      accessibilityLiveRegion="polite"
    >
      <Orb size={150} halo>
        <Wordmark size={26} />
      </Orb>
    </DawnBackground>
  );
};

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
      <DawnBackground className="items-center justify-center gap-3 px-8">
        <Text
          className="text-center font-sans-bold text-xl text-plum"
          accessibilityRole="alert"
        >
          {t("common.errorTitle")}
        </Text>
        <Text className="text-center font-sans text-base leading-6 text-mist-ink">
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
      </DawnBackground>
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
