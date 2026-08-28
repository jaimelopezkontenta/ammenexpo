import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { View } from "react-native";

import { Orb } from "@/components/Orb";
import { Txt } from "@/components/ui/Text";
import { Wordmark } from "@/components/Wordmark";

import { gradients } from "@/theme";

/**
 * El versículo en vertical, para un estado de WhatsApp o una historia.
 *
 * La tarjeta cuadrada sirve para una publicación; una historia ocupa la
 * pantalla entera y en 1:1 sale con dos franjas negras. Como el canal de esta
 * app es justamente ese, el formato tiene que existir.
 *
 * **Todo se mide en fracciones de `width`**, por lo mismo que en `VerseCard`:
 * la misma composición se pinta pequeña para mirarla y a 1080×1920 para
 * capturarla, sin transformaciones de por medio y sin dos maquetaciones.
 *
 * Aquí sí va el orbe. En la cuadrada no —quien comparte un versículo comparte
 * un versículo, no un anuncio—, pero una historia es la superficie más social
 * que tiene el producto y el isotipo al pie es lo que hace que alguien
 * pregunte qué app es esa. Es el mismo componente que el splash y que la
 * pestaña: el isotipo no tiene una versión para compartir.
 */
export const VerseStory = forwardRef<
  View,
  { text: string; reference: string; width?: number }
>(({ text, reference, width = 1080 }, ref) => {
  const height = (width * 16) / 9;
  const scale = width / 1080;

  // Tres tramos y no una fórmula continua, igual que en la cuadrada: los saltos
  // son visibles y se pueden mirar uno a uno. En vertical cabe más letra que en
  // el cuadrado, así que los cuerpos suben.
  const fontSize =
    (text.length > 320 ? 44 : text.length > 140 ? 56 : 72) * scale;

  return (
    <View ref={ref} collapsable={false} style={{ width, height }}>
      <LinearGradient
        colors={gradients.story}
        locations={[0, 0.6, 1]}
        style={{
          width,
          height,
          paddingHorizontal: width * 0.12,
          paddingVertical: height * 0.1,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, justifyContent: "center", gap: height * 0.03 }}>
          {/* Como en VerseCard: el estilo inline manda sobre la escala de la
              variante, que solo aporta familia y tinta. */}
          <Txt
            variant="bodySerif"
            style={{ fontSize, lineHeight: fontSize * 1.45 }}
          >
            {text}
          </Txt>

          <Txt
            variant="editorial"
            style={{ fontSize: 40 * scale, lineHeight: 40 * scale * 1.25 }}
          >
            {reference}
          </Txt>
        </View>

        <View style={{ alignItems: "center", gap: height * 0.012 }}>
          {/* Quieto: esto se captura como una imagen, y una animación en el
              fotograma que se guarda solo puede salir a medias. */}
          <Orb size={width * 0.13} animated={false} />
          <Wordmark size={34 * scale} />
          <Txt
            variant="caption"
            style={{ fontSize: 22 * scale, lineHeight: 22 * scale * 1.25 }}
          >
            ammen.app · Reina-Valera 1909
          </Txt>
        </View>
      </LinearGradient>
    </View>
  );
});

VerseStory.displayName = "VerseStory";
