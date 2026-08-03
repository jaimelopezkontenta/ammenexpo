import { Text } from "react-native";

/**
 * El nombre, en la itálica editorial.
 *
 * Se escribe siempre en minúscula y siempre en Cormorant: es la única palabra
 * de la app que no cambia con el idioma, así que no pasa por `t()` — pero sí
 * lleva `accessibilityLabel`, porque un lector de pantalla leyendo "ammen" en
 * mitad de una pantalla en español lo pronuncia como una palabra y está bien.
 */
export const Wordmark = ({
  size = 26,
  onDark = false,
}: {
  size?: number;
  onDark?: boolean;
}) => (
  <Text
    accessibilityRole="text"
    style={{ fontSize: size, lineHeight: size * 1.25 }}
    className={`font-editorial ${onDark ? "text-white/90" : "text-plum"}`}
  >
    ammen
  </Text>
);
