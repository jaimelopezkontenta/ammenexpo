import { useTranslation } from "react-i18next";

import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export default function Groups() {
  const { t } = useTranslation();

  return (
    <ScreenPlaceholder
      title={t("groups.title")}
      subtitle={t("groups.visibilityPrivate")}
    />
  );
}
