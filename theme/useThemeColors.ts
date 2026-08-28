import { useColorScheme } from "nativewind";

import { colors, colorsDark } from "./tokens";

/**
 * La paleta activa, para lo que NO pasa por NativeWind: iconos de Lucide,
 * `ActivityIndicator`, `placeholderTextColor`, las opciones de
 * react-navigation y los degradados nativos.
 *
 * **El anochecer está ENCENDIDO** (2026-08-28, decisión de Jaime) y sigue al
 * sistema: `useColorScheme()` de nativewind — la MISMA fuente que voltea las
 * variables CSS de las clases, para que la rama JS y la rama CSS no puedan
 * discrepar. No hay toggle de usuario en v1; si llega, va por
 * `colorScheme.set()` de nativewind, no por otra vía. Los otros interruptores
 * viven en `tailwind.config.js` (variables oscuras) y `app.config.js`
 * (`userInterfaceStyle: "automatic"`).
 *
 * El contrato de adopción se mantiene: cada componente declara
 * `const colors = useThemeColors()` — los ~30 sitios de uso encendieron a la
 * vez el día que este hook dejó de devolver la paleta clara fija.
 */
export const useThemeColors = () => {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark" ? colorsDark : colors;
};

/** `true` en el anochecer: los degradados con gemelo y el tint del vidrio. */
export const useIsDark = () => {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark";
};
