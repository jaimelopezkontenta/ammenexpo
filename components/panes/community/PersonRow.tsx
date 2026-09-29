import { Link } from "expo-router";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import type { PersonSearchResult } from "@/core/social/feed";

/**
 * Una persona del buscador: su perfil a un toque y seguirla al lado.
 * Memorizada: seguir a una no repinta el resto de resultados.
 */
export const PersonRow = memo(function PersonRow({
  person,
  pending,
  onFollow,
}: {
  person: PersonSearchResult;
  /** Esta es la que está en vuelo: su botón se apaga hasta que vuelva. */
  pending: boolean;
  onFollow: (targetId: string, following: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center gap-3 rounded-card border border-glassedge/65 bg-glass/60 p-4 shadow-soft">
      <Link
        href={{
          pathname: "/persona/[id]",
          params: { id: person.id },
        }}
        asChild
      >
        <Tap
          accessibilityRole="link"
          className="flex-1 flex-row items-center gap-3"
        >
          <Avatar
            name={person.display_name}
            url={person.avatar_url}
            seed={person.id}
            size={40}
          />
          <View className="flex-1">
            <Txt variant="bodyMedium">{person.display_name}</Txt>
            <Txt variant="caption">
              {t("community.followers", {
                count: person.follower_count,
              })}
            </Txt>
          </View>
        </Tap>
      </Link>

      <Tap
        accessibilityRole="button"
        disabled={pending}
        onPress={() => void onFollow(person.id, person.i_follow)}
      >
        <Txt variant="label" tone="accent">
          {person.i_follow ? t("social.following") : t("social.follow")}
        </Txt>
      </Tap>
    </View>
  );
});
