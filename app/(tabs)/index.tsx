import { useTranslation } from "react-i18next";

import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function Today() {
  const { t } = useTranslation();

  return (
    <ScreenPlaceholder
      title={t("plan.todayTitle")}
      subtitle={t("intercession.nobodyYet")}
    />
  );
}
