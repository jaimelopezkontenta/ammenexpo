import { useColorScheme } from "nativewind";

import { colors, colorsDark } from "./tokens";

/**
 * La paleta activa, para lo que NO pasa por NativeWind: iconos de Lucide,
 * `ActivityIndicator`, `placeholderTextColor`, las opciones de
 * react-navigation y los degradados nativos.
 *
 * **El anochecer está ENCENDIDO** (2026-08-28) y el toggle de usuario vive
 * en Perfil (2026-09-04): Sistema / Oscuro / Claro, persistido en
 * `ammen.theme.v1`. `useColorScheme()` de nativewind es la MISMA fuente que
 * voltea las variables CSS, para que la rama JS y la rama CSS no puedan
 * discrepar. El toggle llama a `colorScheme.set()` — no hay otra vía. Los
 * otros interruptores viven en `tailwind.config.js` (`darkMode: "class"` +
 * variables) y `app.config.js` (`userInterfaceStyle: "automatic"`).
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
