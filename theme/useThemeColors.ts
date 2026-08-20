import { colors } from "./tokens";

/**
 * La paleta activa, para lo que NO pasa por NativeWind: iconos de Lucide,
 * `ActivityIndicator`, `placeholderTextColor`, las opciones de
 * react-navigation y los degradados nativos.
 *
 * **El anochecer está apagado a propósito** (decisión de producto: solo tema
 * claro), así que hoy esto devuelve siempre la paleta clara. La capa oscura
 * quedó lista y medida (`colorsDark`, `theme/contrast.test.ts`): encenderla
 * es devolver aquí la paleta según `useColorScheme()` de nativewind, más los
 * otros dos interruptores que documenta `app.config.js`.
 *
 * El contrato de adopción se mantiene: cada componente declara
 * `const colors = useThemeColors()` con el mismo nombre que el import
 * estático, y ningún sitio de uso cambia cuando el tema llegue de verdad.
 */
export const useThemeColors = () => colors;

/** `true` en el anochecer — hoy nunca, porque el anochecer está apagado. */
export const useIsDark = () => false;
