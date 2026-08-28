import { Txt } from "@/components/ui/Text";
import { colors } from "@/theme";

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
  brand = false,
}: {
  size?: number;
  onDark?: boolean;
  /**
   * Tinta fija de marca (plum de la paleta clara), para superficies que no
   * cambian de tema — la imagen 9:16 que se comparte. Sin esto, la firma
   * seguiría el anochecer y saldría clara sobre el durazno claro.
   */
  brand?: boolean;
}) => (
  <Txt
    variant="editorial"
    tone="primary"
    accessibilityRole="text"
    // El tamaño es del caller (logo grande en la puerta, firma pequeña al
    // pie); el estilo inline gana a la escala de la variante.
    style={{
      fontSize: size,
      lineHeight: size * 1.25,
      ...(brand ? { color: colors.plum.DEFAULT } : null),
    }}
    className={onDark ? "text-white/90" : ""}
  >
    ammen
  </Txt>
);
