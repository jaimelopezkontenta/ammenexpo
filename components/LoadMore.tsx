import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { useThemeColors } from "@/theme";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";

interface Props {
  hasMore: boolean;
  loading: boolean;
  onPress: () => void;
  /** Lo que dice el botón, si «Ver más» no basta (el chat mira hacia atrás). */
  label?: string;
}

/**
 * El final de una lista que continúa.
 *
 * Las listas largas (`FlatList`) ya piden la página siguiente solas al
 * acercarse al final (`useLoadMoreOnEnd`), pero el botón se queda: un lector
 * de pantalla o un teclado recorren la lista de elemento en elemento, sin
 * scroll que dispare nada, y sin él nunca pasarían de la primera página. Y es
 * la señal visible de que hay más: estas son listas donde el fondo importa —
 * llegar al final de tus avisos o de tus testimonios es una forma de terminar.
 *
 * Cuando no hay más, no se pinta nada: un botón desactivado solo invita a
 * pulsarlo para descubrir que no hace nada.
 */
export const LoadMore = ({ hasMore, loading, onPress, label }: Props) => {
  const { t } = useTranslation();
  const colors = useThemeColors();

  if (!hasMore) return null;

  const text = label ?? t("common.loadMore");

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
            accessibilityLabel={text}
          />
        ) : (
          <Txt variant="bodyMedium">{text}</Txt>
        )}
      </Tap>
    </View>
  );
};
