import { Text as RNText, TextProps } from "react-native";

import { MAX_FONT_SCALE } from "@/theme/typography";

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
  | "captionSm" // la letra pequeña de verdad: fechas, pies, rótulos de cifra
  | "label" // el rótulo de un campo
  | "labelStrong" // el rótulo en semibold: acciones de texto, el número del badge
  | "overline" // el rótulo diminuto en mayúsculas que abre una sección
  | "editorial"; // la itálica de los rótulos de tarjeta

export type TxtTone =
  | "primary"
  | "secondary"
  | "accent"
  | "danger"
  | "onDark"
  // La tinta fija del CTA melocotón: el degradado no cambia con el tema, así
  // que su texto tampoco (AGENTS.md, marca fija).
  | "onCta"
  // La cifra de un badge sobre `ember.accent` (5,14:1), fija como el acento.
  | "onBadge";

type TxtProps = TextProps & {
  variant?: TxtVariant;
  tone?: TxtTone;
  /**
   * Subrayado: el enlace o la acción de texto («Reportar», «Términos»).
   * Ortogonal a la variante — va en caption, label y body por igual.
   */
  underline?: boolean;
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
  captionSm: "font-sans text-xs",
  label: "font-sans-medium text-sm",
  labelStrong: "font-sans-semibold text-sm",
  overline: "font-sans-semibold text-xs uppercase tracking-wide",
  editorial: "font-editorial text-lg",
};

const TONE: Record<TxtTone, string> = {
  primary: "text-plum",
  secondary: "text-mist-ink",
  accent: "text-ember-ink",
  danger: "text-danger",
  onDark: "text-white",
  onCta: "text-cta-ink",
  onBadge: "text-badge-ink",
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
  captionSm: "secondary",
  label: "primary",
  labelStrong: "primary",
  overline: "secondary",
  editorial: "accent",
};

export const Txt = ({
  variant = "body",
  tone,
  underline = false,
  className,
  // El tope de la letra del sistema (theme/typography.ts). Un texto que
  // necesite más lo pide con la misma prop de React Native.
  maxFontSizeMultiplier = MAX_FONT_SCALE,
  ...textProps
}: TxtProps) => (
  <RNText
    maxFontSizeMultiplier={maxFontSizeMultiplier}
    // La clase del caller es para afinar márgenes, alineación o `flex-1`,
    // y NO pisa a la variante por ir al final: el orden del string no decide
    // nada. Entre dos clases de la misma familia gana la que va después en la
    // hoja de Tailwind — en web por la cascada, en nativo porque css-interop
    // ordena por `appearanceOrder` — y dentro de una familia Tailwind las
    // emite en orden alfabético. `text-xs` pisa el `text-sm` de caption,
    // pero `text-base` no puede con el `text-lg` de editorial, ni
    // `text-cta-ink` con el `text-plum` de un tono (el CTA de Hoy salió
    // casi blanco en oscuro por eso). El color va siempre por `tone`; el
    // tamaño que una variante no tiene, con otra variante.
    // Guard: theme/txt-overrides.test.ts.
    className={`${VARIANT[variant]} ${TONE[tone ?? DEFAULT_TONE[variant]]}${
      underline ? " underline" : ""
    } ${className ?? ""}`}
    {...textProps}
  />
);
