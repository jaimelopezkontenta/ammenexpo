import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { Txt } from "@/components/ui/Text";
import { useExportMyData } from "@/core/legal/export";
import { useToast } from "@/core/toast/ToastProvider";
import { useAction } from "@/core/toast/useAction";

/**
 * «Descargar mis datos»: el botón, su porqué y el aviso de cómo fue.
 *
 * Vivía solo en Acerca, con su propio `notice`/`error` locales, y ahí no lo
 * encuentra quien no sabe que existe. Ahora es una pieza que se monta donde
 * haga falta (Perfil y Acerca) y la lógica sigue siendo una:
 * `useExportMyData` (core/legal/export.ts).
 */
export const ExportData = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const exportData = useExportMyData();
  const { run } = useAction();

  const handleExport = async () => {
    let outcome: "downloaded" | "shared" | undefined;

    const ok = await run(async () => {
      outcome = await exportData.mutateAsync();
    });

    // En web se descarga y en nativo se comparte: el aviso dice lo que pasó.
    if (ok) {
      toast.success(
        outcome === "downloaded"
          ? t("legal.exportDone")
          : t("legal.exportShared"),
      );
    }
  };

  return (
    <View className="gap-2">
      <Button
        title={t("legal.export")}
        variant="secondary"
        loading={exportData.isPending}
        onPress={() => void handleExport()}
      />
      <Txt variant="caption">{t("legal.exportHint")}</Txt>
    </View>
  );
};
