import { Stack } from "expo-router";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useSession } from "@/core/auth/SessionProvider";
import { goBackOr } from "@/core/nav/safeBack";
import {
  useJoinWaitlist,
  useMyWaitlistEntry,
  waitlistInputError,
} from "@/core/plus/waitlist";
import { useProfile } from "@/core/profile/queries";

import { icon, useThemeColors } from "@/theme";

const FREE = ["paywall.freeCircles", "paywall.freeBible", "paywall.freeShare"];

/**
 * What Ammen Plus is, and — just as important — what it is not.
 *
 * Until now hitting the free limit produced a single red line at the bottom of
 * a form you had already filled in, with no button, no link and nowhere to go.
 * The five `paywall.*` strings had been translated since the first week and no
 * screen ever used them.
 *
 * **This screen does not charge, and it says so.** Nothing writes the
 * `subscriptions` table yet — there is no webhook — so a "Subscribe" button
 * would be a button that cannot work. Promising a purchase that silently fails
 * is worse than admitting the wait.
 *
 * What there is, is the waiting list: a name and an email, kept so we can tell
 * the person when more plans can be created. No button here looks like
 * "Pay" or "Subscribe" — the CTA says "apuntarme", and the copy spells out that
 * it is not a payment.
 */
export default function Plus() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: profile } = useProfile(userId);
  const {
    data: entry,
    isLoading: entryLoading,
    isError: entryError,
    refetch: refetchEntry,
  } = useMyWaitlistEntry(userId);
  const join = useJoinWaitlist(userId);

  // `null` means "not edited", so the field shows the prefilled value until the
  // person types — the same draft-over-server pattern as the plan form and the
  // profile. The name starts from the profile, the email from the session.
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  // True once this session's submit succeeded, so the screen can say "quedaste
  // en la lista" rather than "ya estabas" for the row that just appeared. On a
  // fresh visit the server row decides, which is the honest "ya estabas".
  const [justJoined, setJustJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { scrollBottom } = useScreenPadding();

  const name = draftName ?? profile?.display_name ?? "";
  const email = draftEmail ?? session?.user.email ?? "";

  const fieldError = waitlistInputError(name, email);

  const handleJoin = async () => {
    if (fieldError || !userId) return;

    setError(null);

    try {
      await join.mutateAsync({ name, email });
      setJustJoined(true);
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{ title: t("paywall.title"), headerShown: true }}
      />
      <KeyboardScreen>
        <DawnBackground>
          <ScrollView
            contentContainerClassName="flex-grow gap-8 px-7 py-10 md:w-full md:max-w-read md:self-center"
            contentContainerStyle={{ paddingBottom: scrollBottom }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="font-sans text-base leading-6 text-mist-ink">
              {t("paywall.subtitle")}
            </Text>

            {/* Free first, and it is the longer list. Everything that makes this a
            place to be with other people stays free; what costs money is asking
            a model to write more plans, which is the part that actually costs
            money. Leading with the paid list would misrepresent the deal.

            En tarjetas y con checks, no texto plano apilado: la pantalla que
            explica el trato es la que menos se podía permitir parecer un
            borrador. */}
            <Card label={t("paywall.free")} className="gap-3">
              {FREE.map((key) => (
                <View key={key} className="flex-row items-start gap-3">
                  <Check
                    size={icon.sm}
                    color={colors.ember.ink}
                    strokeWidth={icon.strokeWidth}
                    style={styles.checkAlign}
                  />
                  <Text className="flex-1 font-sans text-base leading-6 text-plum">
                    {t(key)}
                  </Text>
                </View>
              ))}
            </Card>

            <Card label={t("paywall.paid")} className="gap-3">
              <View className="flex-row items-start gap-3">
                <Check
                  size={icon.sm}
                  color={colors.ember.ink}
                  strokeWidth={icon.strokeWidth}
                  style={styles.checkAlign}
                />
                <Text className="flex-1 font-sans text-base leading-6 text-plum">
                  {t("paywall.paidPlans")}
                </Text>
              </View>
            </Card>

            <Text
              className="text-center font-sans text-base leading-6 text-mist-ink"
              accessibilityRole="alert"
            >
              {t("paywall.notYet")}
            </Text>

            {/* La lista de espera es la única salida real de esta pantalla:
            recoger interés sin prometer un pago. */}
            <Card className="gap-4">
              <Text className="font-sans-semibold text-base text-plum">
                {t("paywall.waitlistTitle")}
              </Text>
              <Text className="font-sans text-base leading-6 text-mist-ink">
                {t("paywall.waitlistBody")}
              </Text>

              {entryLoading ? (
                <ActivityIndicator color={colors.plum.DEFAULT} />
              ) : entryError ? (
                <View className="gap-3">
                  <Text
                    className="font-sans text-sm text-danger"
                    accessibilityRole="alert"
                  >
                    {t("common.errorBody")}
                  </Text>
                  <Button
                    title={t("common.retry")}
                    variant="secondary"
                    onPress={() => void refetchEntry()}
                  />
                </View>
              ) : justJoined ? (
                <Text
                  className="font-sans text-base text-plum"
                  accessibilityRole="alert"
                >
                  {t("paywall.waitlistDone")}
                </Text>
              ) : entry ? (
                <Text
                  className="font-sans text-base text-plum"
                  accessibilityRole="alert"
                >
                  {t("paywall.waitlistAlready")}
                </Text>
              ) : (
                <View className="gap-4">
                  <TextField
                    label={t("paywall.waitlistName")}
                    value={name}
                    onChangeText={setDraftName}
                    maxLength={80}
                  />
                  <TextField
                    label={t("paywall.waitlistEmail")}
                    value={email}
                    onChangeText={setDraftEmail}
                    // Para el correo existe la clave de siempre; para el nombre
                    // no hay «el nombre es obligatorio» en ningún idioma, así que
                    // un nombre vacío desactiva el botón en vez de inventar un
                    // texto que no está traducido.
                    error={
                      fieldError === "email" ? t("auth.emailInvalid") : null
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />

                  {error ? (
                    <Text
                      className="font-sans text-sm text-danger"
                      accessibilityRole="alert"
                    >
                      {error}
                    </Text>
                  ) : null}

                  <Button
                    title={t("paywall.waitlistCta")}
                    loading={join.isPending}
                    disabled={fieldError !== null}
                    onPress={() => void handleJoin()}
                  />
                </View>
              )}
            </Card>

            <View className="mt-auto gap-3 pt-6">
              <Button
                title={t("paywall.back")}
                variant="secondary"
                onPress={() => goBackOr("/")}
              />
            </View>
          </ScrollView>
        </DawnBackground>
      </KeyboardScreen>
    </>
  );
}

const styles = StyleSheet.create({
  // Alinea el check con la primera línea del texto (leading-6 = 24px de caja
  // frente a un icono de 20).
  checkAlign: { marginTop: 2 },
});
