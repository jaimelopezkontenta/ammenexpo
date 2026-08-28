import { Text as RNText, TextProps } from "react-native";

/**
 * El texto del sistema. `Txt` y no `Text` para no chocar con el de React
 * Native en los imports mientras conviven.
 *
 * Hasta ahora cada pantalla escribía la tripleta `font-* text-* text-plum` a
 * mano (~500 veces): esta es la tabla única de esas combinaciones, con el
 * tono correcto de serie. Colapsar la repetición es también lo que dejaría un
 * modo oscuro como cambio de una tabla y no de cincuenta pantallas.
 *
 * El contrato de contraste se conserva por construcción: ningún `tone` mapea
 * a los tokens decorativos (`ember.accent`, `mist.DEFAULT`) — el texto usa
 * siempre sus parejas legibles.
 */

export type TxtVariant =
  | "display" // el título de la pantalla de bienvenida y poco más
  | "title" // el título serif del día
  | "heading" // títulos de sección en sans
  | "headingLg" // el título sans entre heading y display (cabeceras de pantalla)
  | "subheading" // el peso semibold de las filas y tarjetas
  | "subheadingLg" // el semibold grande de los títulos de tarjeta
  | "body" // el párrafo por defecto
  | "bodyMedium" // el párrafo con peso medium (valores, nombres en filas)
  | "bodySerif" // el párrafo que se lee despacio, sin la medida de lectura
  | "bodySerifReading" // el cuerpo serif con leading de lectura (peticiones, testimonios)
  | "reading" // la escritura y la oración: Lora con leading generoso
  | "caption" // la letra pequeña
  | "label" // el rótulo de un campo
  | "overline" // el rótulo diminuto en mayúsculas que abre una sección
  | "editorial"; // la itálica de los rótulos de tarjeta

export type TxtTone = "primary" | "secondary" | "accent" | "danger" | "onDark";

type TxtProps = TextProps & {
  variant?: TxtVariant;
  tone?: TxtTone;
};

const VARIANT: Record<TxtVariant, string> = {
  display: "font-sans-bold text-3xl leading-9",
  title: "font-serif-bold text-2xl leading-8",
  heading: "font-sans-bold text-xl",
  headingLg: "font-sans-bold text-2xl",
  subheading: "font-sans-semibold text-base",
  subheadingLg: "font-sans-semibold text-lg",
  body: "font-sans text-base leading-6",
  bodyMedium: "font-sans-medium text-base leading-6",
  bodySerif: "font-serif text-base leading-6",
  bodySerifReading: "font-serif text-base leading-reading",
  reading: "font-serif text-lg leading-reading",
  caption: "font-sans text-sm",
  label: "font-sans-medium text-sm",
  overline: "font-sans-semibold text-xs uppercase tracking-wide",
  editorial: "font-editorial text-lg",
};

const TONE: Record<TxtTone, string> = {
  primary: "text-plum",
  secondary: "text-mist-ink",
  accent: "text-ember-ink",
  danger: "text-danger",
  onDark: "text-white",
};

/** El tono que cada variante lleva si no se pide otro. */
const DEFAULT_TONE: Record<TxtVariant, TxtTone> = {
  display: "primary",
  title: "primary",
  heading: "primary",
  headingLg: "primary",
  subheading: "primary",
  subheadingLg: "primary",
  body: "primary",
  bodyMedium: "primary",
  bodySerif: "primary",
  bodySerifReading: "primary",
  reading: "primary",
  caption: "secondary",
  label: "primary",
  overline: "secondary",
  editorial: "accent",
};

export const Txt = ({
  variant = "body",
  tone,
  className,
  ...textProps
}: TxtProps) => (
  <RNText
    // La clase del caller va al final: en NativeWind, ante conflicto gana la
    // última, así que un `className` puntual puede afinar la variante sin
    // pelearse con ella.
    className={`${VARIANT[variant]} ${TONE[tone ?? DEFAULT_TONE[variant]]} ${
      className ?? ""
    }`}
    {...textProps}
  />
);
