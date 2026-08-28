import { Image } from "expo-image";
import { Text, View } from "react-native";

import { ORB_COLORS } from "@/components/Orb";
import { colors } from "@/theme";

/**
 * Los tonos del orbe, no un arcoíris aleatorio: la inicial de alguien no
 * debería gritar más que su nombre, y una lista de caras es lo que más se
 * repite en la app —el censo de un círculo, quién oró por ti—, así que los
 * colores son los de la marca, importados de su única fuente (`Orb`), no
 * copiados.
 *
 * La tinta es plum en todos. Los fondos son pálidos y dan de 8:1 para arriba;
 * una tinta distinta por tono sería una decisión de color que no aporta nada
 * y cinco pares que mantener medidos.
 *
 * El orden es el histórico de esta lista, no el de las capas del orbe: el
 * tono de cada persona sale de un hash sobre este array, y reordenarlo le
 * cambiaría la cara a todo el mundo.
 */
const TONE_INK = colors.plum.DEFAULT;

const TONES = [
  ORB_COLORS.orbPeach,
  ORB_COLORS.orbLavender,
  ORB_COLORS.orbBlue,
  ORB_COLORS.orbLilac,
  ORB_COLORS.orbBase,
];

/** Estable para la misma persona, sin guardar nada: siempre el mismo tono. */
const toneFor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return TONES[hash % TONES.length];
};

/**
 * La inicial, no dos: "MG" obliga a saber el apellido, y aquí mucha gente pone
 * solo el nombre. `Intl.Segmenter` no hace falta — un nombre en español empieza
 * por una letra, y `charAt(0)` la coge bien incluso acentuada.
 */
const initialOf = (name: string) =>
  (name.trim().charAt(0) || "·").toUpperCase();

interface AvatarProps {
  name: string;
  url?: string | null;
  /** El id de la persona, para que el tono sea suyo y no del nombre. */
  seed?: string;
  size?: number;
}

/**
 * La cara de alguien, o su inicial.
 *
 * `avatar_url` viajaba en trece RPC desde la Fase 1 y no se pintaba en ningún
 * sitio. Esta es la otra mitad.
 *
 * **La alternativa no es un icono de persona gris.** Un muñeco anónimo repetido
 * quince veces en una lista no distingue a nadie; una inicial sobre un tono
 * estable sí, y además no obliga a subir una foto a quien no quiere.
 */
export const Avatar = ({ name, url, seed, size = 40 }: AvatarProps) => {
  const tone = toneFor(seed || name || "?");

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        // **Sin esto, en web no carga nunca.** expo-image pone
        // `loading="lazy"` por defecto, y la carga diferida depende de que el
        // navegador vea el elemento entrar en el viewport — pero el `body` de
        // esta app no hace scroll (`ScrollViewStyleReset` lo deja en
        // `overflow: hidden` para que los ScrollView se comporten como en
        // nativo), así que ese cruce no ocurre jamás y la cara se queda en
        // blanco. Diferir un avatar de 40 px tampoco ahorra nada.
        loading="eager"
        // Decorativa: el nombre va escrito al lado en todas las pantallas donde
        // se usa, y anunciarlo dos veces sobra. **`aria-hidden` aparte**: las
        // dos props nativas no se traducen a nada en react-native-web, y desde
        // que la cara vive dentro de un enlace (el censo del círculo, quién oró
        // por ti) eso hacía que el enlace se anunciara como "A Ana".
        accessibilityElementsHidden
        importantForAccessibility="no"
        aria-hidden
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone,
      }}
      className="items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no"
      aria-hidden
    >
      <Text
        style={{ color: TONE_INK, fontSize: size * 0.42 }}
        className="font-sans-semibold"
      >
        {initialOf(name)}
      </Text>
    </View>
  );
};
