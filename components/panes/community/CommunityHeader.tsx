import { Link } from "expo-router";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Txt } from "@/components/ui/Text";

/**
 * Lo de arriba de Comunidad: el buscador y, con el feed a la vista, de quién es
 * lo que se ve y el botón de pedir oración.
 *
 * Va como cabecera de la lista y se pasa como elemento, no como componente:
 * así React lo reconcilia en su sitio y el campo no se desmonta —ni pierde el
 * foco y el teclado— cuando la lista cambia del feed a las personas.
 */
export const CommunityHeader = memo(function CommunityHeader({
  query,
  onQueryChange,
  following,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  /** A cuántos sigues; `null` cuando no se está enseñando el feed. */
  following: number | null;
}) {
  const { t } = useTranslation();

  return (
    <View className="gap-5">
      <TextField
        skin="dawn"
        hideLabel
        label={t("community.searchPlaceholder")}
        className="py-3.5"
        value={query}
        onChangeText={onQueryChange}
        placeholder={t("community.searchPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {following !== null ? (
        <>
          {/* De quién es lo que se ve. Con cero seguidos el servidor sirve
                lo público reciente —un feed vacío el primer día es la forma más
                rápida de no volver— y sin decirlo parece que la app enseña
                desconocidos porque sí. */}
          <Txt variant="caption">
            {following > 0
              ? t("community.fromFollowing", { count: following })
              : t("community.fromEveryone")}
          </Txt>

          <Link href="/peticiones/nueva" asChild>
            <Button title={t("feed.newPost")} variant="secondary" />
          </Link>
        </>
      ) : null}
    </View>
  );
});
