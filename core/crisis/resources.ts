/**
 * Líneas de crisis por país, para `app/crisis.tsx`.
 *
 * **Pendiente de revisión por especialista** (RDY-06, `docs/runbooks/
 * crisis-es-en.md`): esta tabla es un mínimo defendible, no un protocolo
 * aprobado. Solo entran números públicos, estables y de los que no hay duda;
 * ante la duda, un país se queda fuera y cae en «Otros países» (el buscador
 * de findahelpline.com y los números de emergencias). Cada entrada lleva la
 * fecha en que se comprobó y queda pendiente de que un especialista la
 * revise antes de abrir al público.
 *
 * Puro: sin `expo-localization` ni `react-native`. La pantalla pasa la región
 * del dispositivo y el idioma de la app, y los textos viven en i18n
 * (`crisis.lines.<REGIÓN>.*`), no aquí.
 */

export type CrisisRegion =
  "ES" | "US" | "CA" | "GB" | "IE" | "AU" | "MX" | "AR";

export type CrisisLine = {
  region: CrisisRegion;
  /** Lo que se marca: solo dígitos. */
  phone: string;
  /** Como se escribe en ese país, para el botón. */
  display: string;
  /** Emergencias del país, solo si no hay ninguna duda. */
  emergency?: string;
};

export const CRISIS_LINES: readonly CrisisLine[] = [
  // Línea 024 de atención a la conducta suicida (Ministerio de Sanidad).
  // verifiedOn: "2026-09-29 (pendiente de revisión por especialista)"
  { region: "ES", phone: "024", display: "024", emergency: "112" },
  // 988 Suicide & Crisis Lifeline.
  // verifiedOn: "2026-09-29 (pendiente de revisión por especialista)"
  { region: "US", phone: "988", display: "988", emergency: "911" },
  // 9-8-8 Suicide Crisis Helpline.
  // verifiedOn: "2026-09-29 (pendiente de revisión por especialista)"
  { region: "CA", phone: "988", display: "988", emergency: "911" },
  // Samaritans (Reino Unido).
  // verifiedOn: "2026-09-29 (pendiente de revisión por especialista)"
  { region: "GB", phone: "116123", display: "116 123", emergency: "999" },
  // Samaritans (Irlanda).
  // verifiedOn: "2026-09-29 (pendiente de revisión por especialista)"
  { region: "IE", phone: "116123", display: "116 123", emergency: "112" },
  // Lifeline Australia.
  // verifiedOn: "2026-09-29 (pendiente de revisión por especialista)"
  { region: "AU", phone: "131114", display: "13 11 14", emergency: "000" },
  // Línea de la Vida (CONASAMA, Secretaría de Salud).
  // verifiedOn: "2026-09-29 (pendiente de revisión por especialista)"
  {
    region: "MX",
    phone: "8009112000",
    display: "800 911 2000",
    emergency: "911",
  },
  // Centro de Asistencia al Suicida: el 135 solo desde CABA y GBA, y no
  // atiende las 24 horas (lo dice su texto). Sin número de emergencias: el
  // 911 no llega igual a todas las provincias.
  // verifiedOn: "2026-09-29 (pendiente de revisión por especialista)"
  { region: "AR", phone: "135", display: "135" },
];

/** El buscador de líneas por país para quien no está en la tabla. */
export const FIND_A_HELPLINE_URL = "https://findahelpline.com";

const lineFor = (region: string | null): CrisisLine | undefined =>
  region ? CRISIS_LINES.find((line) => line.region === region) : undefined;

/** `ES`, `es` o ` es ` → `ES`; nada, o una región numérica (`419`), → `null`. */
const normalizeRegion = (regionCode: string | null | undefined) => {
  const region = regionCode?.trim().toUpperCase();
  return region && /^[A-Z]{2}$/.test(region) ? region : null;
};

/**
 * Qué líneas enseñar y en qué orden: primero la del país del dispositivo si
 * está en la tabla; después España si la app está en español (el producto
 * nace en España, y es lo que se enseñaba hasta ahora). Nunca repetida. Una
 * lista vacía no es un error: la pantalla enseña entonces solo «Otros
 * países».
 */
export const selectCrisisLines = ({
  regionCode,
  language,
}: {
  regionCode: string | null | undefined;
  language: string | null | undefined;
}): CrisisLine[] => {
  const lines: CrisisLine[] = [];
  const add = (line: CrisisLine | undefined) => {
    if (line && !lines.includes(line)) lines.push(line);
  };

  add(lineFor(normalizeRegion(regionCode)));

  if (language?.trim().toLowerCase().startsWith("es")) {
    add(lineFor("ES"));
  }

  return lines;
};

/**
 * El número de emergencias que ofrecer como botón: solo el del país del
 * dispositivo. El de España a quien está en otro sitio sería marcar un
 * número que allí puede no existir; para eso está el texto informativo.
 */
export const emergencyNumberFor = (
  regionCode: string | null | undefined,
): string | null => lineFor(normalizeRegion(regionCode))?.emergency ?? null;

export const telUrl = (phone: string): string => `tel:${phone}`;
