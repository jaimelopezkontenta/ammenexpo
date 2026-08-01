import { Image } from "expo-image";
import { Text, View } from "react-native";

/**
 * Seis tonos del papel y el barro del tema, no un arcoíris aleatorio: la
 * inicial de alguien no debería gritar más que su nombre.
 */
const TONES = [
  { bg: "#E6DFD5", ink: "#635C55" },
  { bg: "#F3E7DC", ink: "#7A4C31" },
  { bg: "#DFE3DC", ink: "#4F5A4C" },
  { bg: "#E8DCE0", ink: "#6B4A55" },
  { bg: "#DDE2E8", ink: "#4C5866" },
  { bg: "#EDE3CF", ink: "#6E5A2E" },
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
        // se usa, y anunciarlo dos veces sobra.
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tone.bg,
      }}
      className="items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text
        style={{ color: tone.ink, fontSize: size * 0.42 }}
        className="font-semibold"
      >
        {initialOf(name)}
      </Text>
    </View>
  );
};
