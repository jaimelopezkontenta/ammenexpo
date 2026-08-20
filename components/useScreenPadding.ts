import { useSafeAreaInsets } from "react-native-safe-area-context";

// SafeAreaProvider no aplica padding: envuelve la app y deja los insets
// disponibles, pero es cada pantalla quien decide dónde respirar. Este hook es
// la fuente única para los stacks; las tabs no lo usan porque TabHeader ya
// resuelve su propio margen superior.
export const HEADER_GAP = 8;
export const SCREEN_Y = 32;

export const useScreenPadding = () => {
  const insets = useSafeAreaInsets();
  return {
    top: insets.top + HEADER_GAP,
    /** Home indicator: no menos de 16. */
    bottom: Math.max(insets.bottom, 16),
    /** Scroll: py-8 (32) o el inset si es mayor. */
    scrollBottom: Math.max(insets.bottom, SCREEN_Y),
  };
};
