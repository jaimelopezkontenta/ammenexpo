import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import {
  MESSAGE_MAX,
  QUICK_MESSAGE_KEYS,
  type SharedPlan,
} from "@/core/intercessions/queries";

type Props = {
  plan: SharedPlan;
  pending: boolean;
  onPray: (message?: string) => void;
};

/**
 * One person, their day, and the button.
 *
 * The bare gesture stays a single tap — that is what makes the loop work — and
 * the message is a deliberate second step for people who want to say something.
 * Putting the composer in the way of everyone would cost far more taps than the
 * warmth is worth.
 */
export const PrayForCard = ({ plan, pending, onPray }: Props) => {
  const { t } = useTranslation();

  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");

  const quickPhrases = QUICK_MESSAGE_KEYS.map((key) => ({
    key,
    label: t(`intercession.quick.${key}`),
  }));

  const send = () => {
    onPray(message.trim() || undefined);
    setComposing(false);
    setMessage("");
  };

  return (
    <View className="gap-4 rounded-3xl bg-slate-50 p-5">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-slate-900">
          {plan.owner_name}
        </Text>
        <Text className="text-sm text-slate-500">{plan.plan_title}</Text>
      </View>

      <View className="gap-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t("common.day", { number: plan.day_number })}
        </Text>
        <Text className="text-base leading-6 text-slate-800">
          {plan.day_title}
        </Text>
        {plan.scripture_ref ? (
          <Text className="text-sm text-slate-500">{plan.scripture_ref}</Text>
        ) : null}
      </View>

      {plan.already_prayed ? (
        <Text className="text-base font-medium text-slate-600">
          {t("intercession.prayedFor", { name: plan.owner_name })}
        </Text>
      ) : composing ? (
        <View className="gap-3">
          <View className="flex-row flex-wrap gap-2">
            {quickPhrases.map((phrase) => (
              <Pressable
                key={phrase.key}
                accessibilityRole="button"
                accessibilityLabel={phrase.label}
                onPress={() => setMessage(phrase.label)}
                className="rounded-full bg-white px-4 py-2"
              >
                <Text className="text-sm text-slate-700">{phrase.label}</Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label={t("intercession.messageLabel")}
            value={message}
            onChangeText={setMessage}
            placeholder={t("intercession.messagePlaceholder")}
            maxLength={MESSAGE_MAX}
            multiline
          />

          <Button
            title={t("intercession.prayFor")}
            loading={pending}
            onPress={send}
          />
          <Button
            title={t("common.cancel")}
            variant="ghost"
            onPress={() => {
              setComposing(false);
              setMessage("");
            }}
          />
        </View>
      ) : (
        <View className="gap-2">
          <Button
            title={t("intercession.prayFor")}
            loading={pending}
            onPress={() => onPray()}
          />
          <Button
            title={t("intercession.addMessage")}
            variant="ghost"
            onPress={() => setComposing(true)}
          />
        </View>
      )}
    </View>
  );
};
