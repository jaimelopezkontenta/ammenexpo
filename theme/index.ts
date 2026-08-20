/**
 * La puerta del tema para el JSX: `import { colors, icon, gradients } from "@/theme"`.
 *
 * Existe porque Lucide y las opciones de react-navigation no pasan por
 * NativeWind: lo que no puede ser una clase de Tailwind sale de aquí, del
 * mismo módulo que alimenta a `tailwind.config.js`.
 */
export { colors, colorsDark, borderRadius, boxShadow, icon } from "./tokens";
export { gradients, withAlpha } from "./gradients";
export { useThemeColors, useIsDark } from "./useThemeColors";
