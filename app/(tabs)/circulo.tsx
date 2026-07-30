import { useTranslation } from "react-i18next";

import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function Circle() {
  const { t } = useTranslation();

  return (
    <ScreenPlaceholder
      title={t("circle.title")}
      subtitle={t("circle.subtitle")}
    />
  );
}
