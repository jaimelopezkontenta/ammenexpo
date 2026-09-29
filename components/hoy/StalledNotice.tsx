import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";

/**
 * El aviso de generación a medias es verdad, pero no puede sentarse entre la
 * Palabra y el amén: vive debajo de la fila meta y antes del título, para que
 * el journey quede libre para rezar. Una línea discreta y no un Card: quien
 * ya tiene día hoy viene a orar, no a arreglar la generación.
 */
export const StalledNotice = ({
  written,
  total,
  pending,
  onResume,
}: {
  written: number;
  total: number;
  pending: boolean;
  onResume: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <View className="gap-1.5">
      <Txt variant="caption">{t("plan.stalledBody", { written, total })}</Txt>
      <Tap
        accessibilityRole="button"
        accessibilityState={{ busy: pending }}
        aria-busy={pending}
        disabled={pending}
        hitSlop={8}
        onPress={onResume}
        className={`self-start py-1 ${pending ? "opacity-50" : ""}`}
      >
        {/* El mismo tono que el label del Button ghost: el naranja
            que sí se lee, reservado para lo que pide acción. */}
        <Txt variant="labelStrong" tone="accent">
          {t("plan.stalledCta")}
        </Txt>
      </Tap>
    </View>
  );
};
