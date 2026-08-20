import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { useThemeColors } from "@/theme";

import { Tap } from "@/components/ui/Tap";

interface Props {
  hasMore: boolean;
  loading: boolean;
  onPress: () => void;
}

/**
 * El final de una lista que continúa.
 *
 * Un botón y no scroll infinito: el scroll infinito no tiene fondo, y estas son
 * listas donde el fondo importa — llegar al final de tus avisos o de tus
 * testimonios es una forma de terminar. Además evita cargar páginas por accidente
 * mientras alguien recorre buscando algo concreto.
 *
 * Cuando no hay más, no se pinta nada: un botón desactivado solo invita a
 * pulsarlo para descubrir que no hace nada.
 */
export const LoadMore = ({ hasMore, loading, onPress }: Props) => {
  const { t } = useTranslation();
  const colors = useThemeColors();

  if (!hasMore) return null;

  return (
    <View className="items-center py-2">
      <Tap
        accessibilityRole="button"
        accessibilityState={{ busy: loading }}
        disabled={loading}
        onPress={onPress}
        className="rounded-cta border border-glassedge/60 bg-glass/60 px-5 py-3"
      >
        {loading ? (
          // El nombre accesible se mantiene aparte: sustituir el texto por el
          // indicador dejaba al lector de pantalla anunciando "botón, ocupado"
          // sin decir cuál — el mismo fallo que ya se corrigió en `Button`.
          <ActivityIndicator
            color={colors.mist.ink}
            accessibilityLabel={t("common.loadMore")}
          />
        ) : (
          <Text className="font-sans-medium text-base text-plum">
            {t("common.loadMore")}
          </Text>
        )}
      </Tap>
    </View>
  );
};
