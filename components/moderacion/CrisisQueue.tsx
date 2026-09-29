import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { TextField } from "@/components/TextField";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { useUserId } from "@/core/auth/useUserId";
import { useAction } from "@/core/toast/useAction";
import { useAcknowledgeCrisis, useCrisisQueue } from "@/core/moderation/queue";

import { AuthorProfileLink } from "./AuthorProfileLink";
import { requiredText, unacknowledged } from "./moderationView";
import { QueueBody } from "./QueueBody";

/**
 * 3. Crisis (B1b) — la guardia. Nunca comparte cola con lo anterior: no es
 * "contenido por revisar", es un registro de guardia. Deliberadamente sin
 * paginar, sin estados intermedios y sin nada que se parezca a "moderar": la
 * única acción es acusar recibo, con una nota de qué se hizo.
 */
export const CrisisQueue = () => {
  const { t } = useTranslation();
  const userId = useUserId();

  // El acuse, hecho o fallido, es un toast; la nota que falta se queda en
  // línea hasta que se escribe (como el motivo de los retenidos).
  const { run } = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queue = useCrisisQueue(userId);
  const acknowledge = useAcknowledgeCrisis();

  const setNoteFor = (id: string, value: string) =>
    setNotes((prev) => ({ ...prev, [id]: value }));

  const open = unacknowledged(queue.data);

  return (
    <View className="gap-5">
      <Txt variant="caption">{t("moderation.crisisHint")}</Txt>

      {invalid ? (
        <Txt variant="caption" tone="danger" accessibilityRole="alert">
          {invalid}
        </Txt>
      ) : null}

      <QueueBody
        loading={queue.isLoading}
        failed={queue.isLoadingError}
        onRetry={() => void queue.refetch()}
        empty={open.length === 0}
        emptyText={t("moderation.crisisEmpty")}
      >
        {open.map((escalation) => (
          <View
            key={escalation.id}
            className="gap-3 rounded-card border border-danger p-5"
          >
            <Txt variant="overline">
              {new Date(escalation.created_at).toLocaleString()}
            </Txt>

            <Txt variant="bodySerifReading">
              {escalation.body ?? t("moderation.contentGone")}
            </Txt>

            <Txt variant="caption">
              {t("moderation.writtenBy", { name: escalation.author_name })}
            </Txt>

            <AuthorProfileLink authorId={escalation.author_id} />

            <TextField
              label={t("moderation.notePlaceholder")}
              value={notes[escalation.id] ?? ""}
              onChangeText={(value) => setNoteFor(escalation.id, value)}
              placeholder={t("moderation.notePlaceholder")}
              multiline
            />

            <Tap
              accessibilityRole="button"
              onPress={() => {
                const note = requiredText(notes[escalation.id]);

                if (!note) {
                  setInvalid(t("moderation.noteRequired"));
                  return;
                }
                setInvalid(null);

                void run(
                  () =>
                    acknowledge.mutateAsync({
                      escalationId: escalation.id,
                      note,
                    }),
                  t("moderation.acknowledgeDone"),
                );
              }}
            >
              <Txt variant="label" className="underline">
                {t("moderation.acknowledge")}
              </Txt>
            </Tap>
          </View>
        ))}
      </QueueBody>
    </View>
  );
};
