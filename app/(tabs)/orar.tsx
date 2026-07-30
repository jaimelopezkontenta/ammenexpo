import { useTranslation } from "react-i18next";

import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function Pray() {
  const { t } = useTranslation();

  return (
    <ScreenPlaceholder title={t("pray.title")} subtitle={t("pray.subtitle")} />
  );
}
