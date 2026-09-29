import { memo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import type { Testimony } from "@/core/testimonies/queries";

/**
 * Lo que una tarjeta puede pedir, con el id por argumento: un solo objeto para
 * todas las filas, así `memo` compara lo mismo de un render al siguiente.
 */
export type TestimonyActions = {
  share: (body: string) => void;
  makePrivate: (id: string) => void;
  /** Primer toque de «Borrar»: pide confirmación en la propia tarjeta. */
  askDelete: (id: string) => void;
  /** Segundo toque: borra de verdad. */
  confirmDelete: (id: string) => void;
  report: (id: string) => void;
  block: (userId: string, name: string) => void;
};

/**
 * Un testimonio de la lista. Memorizada: confirmar el borrado de una, o que
 * llegue la página siguiente, no repinta las demás.
 */
export const TestimonyCard = memo(function TestimonyCard({
  entry,
  confirmingDelete,
  actions,
}: {
  entry: Testimony;
  /** Una sola tarjeta pide confirmación a la vez: la pantalla sabe cuál. */
  confirmingDelete: boolean;
  actions: TestimonyActions;
}) {
  const { t } = useTranslation();

  return (
    <View className="gap-2 rounded-card border border-glassedge/65 bg-glass/60 p-5 shadow-soft">
      <View className="flex-row items-center gap-2">
        <Avatar
          name={entry.author_name}
          url={entry.author_avatar_url}
          seed={entry.author_id}
          size={28}
        />
        <Txt variant="label" tone="secondary">
          {entry.author_name}
        </Txt>
      </View>

      <Txt variant="bodySerifReading">{entry.body}</Txt>

      {entry.plan_title ? (
        <Txt variant="caption">
          {t("testimony.duringPlan", { title: entry.plan_title })}
        </Txt>
      ) : null}

      {/* Yours carries the way back: somebody who shared and regretted it
        needs a door, not a support email. Everyone else's carries the
        same two controls as any other text one person wrote for
        another. */}
      <View className="flex-row flex-wrap gap-4 pt-1">
        {entry.is_mine ? (
          <>
            {/* Lo más contable que tiene el producto —«oramos un mes y
              pasó esto»— y solo se podía leer aquí dentro. Un testimonio
              que no sale de la app es una historia que no le llega a
              nadie que aún no esté. */}
            <Tap
              accessibilityRole="button"
              onPress={() => actions.share(entry.body)}
            >
              <Txt variant="caption" tone="accent" className="underline">
                {t("testimony.share")}
              </Txt>
            </Tap>

            {entry.visibility !== "private" ? (
              <Tap
                accessibilityRole="button"
                onPress={() => actions.makePrivate(entry.id)}
              >
                <Txt variant="caption" className="underline">
                  {t("testimony.makePrivate")}
                </Txt>
              </Tap>
            ) : null}

            <Tap
              accessibilityRole="button"
              onPress={() =>
                confirmingDelete
                  ? actions.confirmDelete(entry.id)
                  : actions.askDelete(entry.id)
              }
            >
              <Txt
                variant="caption"
                tone={confirmingDelete ? "danger" : "secondary"}
                className={
                  confirmingDelete ? "font-sans-semibold" : "underline"
                }
                accessibilityLiveRegion={confirmingDelete ? "polite" : "none"}
              >
                {confirmingDelete
                  ? t("testimony.deleteConfirm")
                  : t("testimony.delete")}
              </Txt>
            </Tap>
          </>
        ) : (
          <>
            <Tap
              accessibilityRole="button"
              onPress={() => actions.report(entry.id)}
            >
              <Txt variant="caption" className="underline">
                {t("moderation.report")}
              </Txt>
            </Tap>

            <Tap
              accessibilityRole="button"
              accessibilityLabel={`${t("moderation.block")} ${entry.author_name}`}
              onPress={() => actions.block(entry.author_id, entry.author_name)}
            >
              <Txt variant="caption" className="underline">
                {t("moderation.block")}
              </Txt>
            </Tap>
          </>
        )}
      </View>
    </View>
  );
});
