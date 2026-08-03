/**
 * Los iconos de la app, desde el isotipo.
 *
 * Se ejecuta a mano —`npm run icons`— y no en cada build: los PNG resultantes
 * están versionados, que es lo que quieren Expo, la App Store y las arañas de
 * WhatsApp. Volver a correrlo solo hace falta si cambia `assets/orb.svg`.
 *
 * La fuente es ese SVG, que a su vez es la misma pila de degradados que
 * `components/Orb.tsx`. Los valores se deciden en `prototipo/TOKENS.md`.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "assets", "orb.svg");

/** El crema del sistema: el mismo que `app.json` pone detrás del splash. */
const CREAM = { r: 255, g: 246, b: 234, alpha: 1 };

const TARGETS = [
  // El icono de iOS y el de la web: el orbe ocupa casi todo el cuadro.
  { out: "assets/icon.png", size: 1024, padding: 0.08 },
  { out: "assets/favicon.png", size: 196, padding: 0.06 },
  // Android recorta el icono adaptativo a un círculo o a un cuadrado con
  // esquinas muy redondeadas, y se queda con el 66 % central: sin este margen
  // el orbe saldría cortado por los cuatro lados.
  { out: "assets/adaptive-icon.png", size: 1024, padding: 0.28 },
  // El splash nativo se escala sobre el fondo crema, así que el orbe va suelto
  // y pequeño en el centro.
  { out: "assets/splash.png", size: 1024, padding: 0.32 },
  // La tarjeta de un enlace compartido. Cuadrada a propósito: `+html.tsx`
  // declara `summary` y no `summary_large_image`, porque una imagen cuadrada en
  // una tarjeta ancha sale recortada por los lados.
  { out: "public/og.png", size: 1200, padding: 0.22 },
];

const build = async ({ out, size, padding }) => {
  const inner = Math.round(size * (1 - padding * 2));
  const margin = Math.round((size - inner) / 2);

  const orb = await sharp(source, { density: 600 })
    .resize(inner, inner, { fit: "contain", background: { ...CREAM, alpha: 0 } })
    .png()
    .toBuffer();

  const target = path.join(root, out);
  await mkdir(path.dirname(target), { recursive: true });

  await sharp({
    create: { width: size, height: size, channels: 4, background: CREAM },
  })
    .composite([{ input: orb, top: margin, left: margin }])
    .png()
    .toFile(target);

  console.log(`${out}  ${size}×${size}`);
};

for (const target of TARGETS) {
  await build(target);
}
