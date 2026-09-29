import { Link } from "expo-router";
import { useTranslation } from "react-i18next";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";

/** «Ver perfil» de quien escribió lo que se modera. */
export const AuthorProfileLink = ({ authorId }: { authorId: string }) => {
  const { t } = useTranslation();

  return (
    <Link
      href={{ pathname: "/persona/[id]", params: { id: authorId } }}
      asChild
    >
      <Tap accessibilityRole="link">
        <Txt variant="caption" tone="accent" underline>
          {t("moderation.openProfile")}
        </Txt>
      </Tap>
    </Link>
  );
};
