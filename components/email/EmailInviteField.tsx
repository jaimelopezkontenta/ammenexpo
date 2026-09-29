import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/ui/Text";
import { useEnqueueInviteEmail } from "@/core/email/queries";
import { useToast } from "@/core/toast/ToastProvider";

type Props = {
  kind: "app" | "circle" | "plan";
  token: string | null | undefined;
};

/**
 * Un campo de correo junto al share sheet. Un envío, confirmación por toast.
 * No es un formulario de campaña: el destinatario puede no tener cuenta.
 */
export const EmailInviteField = ({ kind, token }: Props) => {
  const { t } = useTranslation();
  const toast = useToast();
  const send = useEnqueueInviteEmail();
  const [email, setEmail] = useState("");

  const invalid = email.trim().length > 0 && !email.includes("@");
  const canSend = Boolean(token) && email.includes("@") && !send.isPending;

  const handleSend = async () => {
    if (!token || !canSend) return;

    try {
      await send.mutateAsync({ kind, toEmail: email, token });
      setEmail("");
      toast.success(t("email.inviteSent"));
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "";
      toast.error(
        reason === "rate_limited"
          ? t("email.inviteRateLimited")
          : t("common.errorGeneric"),
      );
    }
  };

  return (
    <View className="gap-3">
      <TextField
        label={t("email.inviteField")}
        value={email}
        onChangeText={setEmail}
        error={invalid ? t("auth.emailInvalid") : null}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Button
        title={t("email.inviteSend")}
        variant="secondary"
        disabled={!canSend}
        loading={send.isPending}
        onPress={() => void handleSend()}
      />
      <Txt variant="caption">{t("email.inviteHint")}</Txt>
    </View>
  );
};
