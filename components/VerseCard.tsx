import { forwardRef } from "react";
import { Text, View } from "react-native";

/**
 * El versículo, como imagen.
 *
 * Cuadrada y de 1080: es lo que piden a la vez el estado de WhatsApp, las
 * historias y una publicación normal, y en mercados hispanohablantes el canal es
 * ese, no un enlace.
 *
 * **Todo se mide en fracciones de `size`.** La primera versión tenía tipos y
 * márgenes en píxeles absolutos y se enseñaba encogida con un `transform`
 * — y al capturarla salía una imagen de 450 px con el papel en blanco, porque
 * `html2canvas` rasteriza lo que hay en pantalla, escalado incluido. Con las
 * medidas relativas, la misma tarjeta se pinta pequeña para mirarla y grande
 * para capturarla, sin transformaciones de por medio y sin dos maquetaciones.
 *
 * El texto **no se encoge para caber**: crece el cuerpo de la tarjeta. Un
 * versículo largo —Ester 8:9 es el más largo de la Biblia— con letra de seis
 * puntos no se lee, y el punto entero de esto es que se lea.
 */
export const VerseCard = forwardRef<
  View,
  { text: string; reference: string; size?: number }
>(({ text, reference, size = 1080 }, ref) => {
  // Un versículo de dos palabras («Y lloró Jesús») pide letra grande; uno de
  // cuatrocientos caracteres pide que quepa. Tres tramos y no una fórmula
  // continua: los saltos son visibles, predecibles y se pueden mirar uno a uno.
  const scale = size / 1080;
  const fontSize =
    (text.length > 320 ? 34 : text.length > 140 ? 44 : 60) * scale;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: size,
        height: size,
        padding: size * 0.11,
        // El hueco no es decorativo: medido, el versículo más largo de la
        // Biblia llegaba a **tocar** la referencia. No se solapaban, pero cero
        // píxeles de margen es un choque esperando a una métrica ligeramente
        // distinta.
        gap: size * 0.05,
        backgroundColor: "#FBF8F4",
      }}
      className="justify-between"
    >
      <View className="flex-1 justify-center">
        <Text
          style={{ fontSize, lineHeight: fontSize * 1.45 }}
          className="font-serif text-ink"
        >
          {text}
        </Text>
      </View>

      <View className="flex-row items-end justify-between">
        <Text
          style={{ fontSize: 30 * scale }}
          className="font-serif-bold text-clay"
        >
          {reference}
        </Text>
        {/* Sin logotipo ni marca de agua encima del texto: quien comparte esto
            comparte un versículo, no un anuncio. El nombre abajo y pequeño es
            todo lo que hace falta para que alguien pregunte de dónde salió. */}
        <Text style={{ fontSize: 24 * scale }} className="text-ink-soft">
          Ammen · Reina-Valera 1909
        </Text>
      </View>
    </View>
  );
});

VerseCard.displayName = "VerseCard";
