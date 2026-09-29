/**
 * Cómo sale del teléfono el fichero de «Descargar mis datos».
 *
 * Antes iba entero como texto de `Share.share({ message })`, y a partir de
 * un mega la hoja de compartir fallaba (Android no pasa más de ~1 MB de una
 * app a otra en un intent): justo quien más ha escrito se quedaba sin poder
 * llevárselo. Ahora se escribe un `.json` en la caché y se comparte el
 * fichero; el texto queda solo como reserva si el fichero no se puede.
 *
 * Puro a propósito (sin `expo-file-system`, `expo-sharing` ni
 * `react-native`): el pegamento vive en `export.ts` y esto se prueba en
 * Vitest con dependencias falsas.
 */

export const EXPORT_MIME_TYPE = "application/json";
/** El UTI de iOS para JSON: sin él, la hoja no ofrece «Guardar en Archivos» como JSON. */
export const EXPORT_UTI = "public.json";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * `ammen-mis-datos-AAAA-MM-DD.json`, con la fecha **local**: a las doce y
 * media de la noche en Madrid, la de UTC todavía es ayer.
 */
export const exportFilename = (date: Date = new Date()): string =>
  `ammen-mis-datos-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}.json`;

/**
 * En web «guardar un fichero» es descargarlo; en el teléfono es elegir a qué
 * app va (Archivos, Drive, el correo).
 */
export const exportDeliveryFor = (
  platform: string,
  hasDocument: boolean,
): "download" | "share-file" =>
  platform === "web" && hasDocument ? "download" : "share-file";

export type PreparedFile = { uri: string; remove: () => void };

export type NativeExportDeps = {
  /** Escribe el fichero temporal (y retira el de un export anterior). */
  prepareFile: (name: string, contents: string) => PreparedFile;
  canShareFiles: () => Promise<boolean>;
  shareFile: (uri: string, name: string) => Promise<void>;
  /** Lo de antes: el JSON como texto en la hoja de compartir. */
  shareMessage: (title: string, message: string) => Promise<void>;
  onError?: (error: unknown) => void;
};

const removeQuietly = (file: PreparedFile, report: (e: unknown) => void) => {
  try {
    file.remove();
  } catch (error) {
    report(error);
  }
};

/**
 * Comparte el export como fichero y, si eso no se puede, como texto.
 *
 * `removeAfterShare`: en iOS la promesa se resuelve cuando la actividad ya
 * terminó (el fichero ya se copió a donde fuera), así que se borra en el
 * acto. En Android se resuelve al volver del selector, y hay destinos (subir
 * a Drive) que leen el fichero después, en segundo plano: allí se queda en la
 * caché privada de la app hasta el próximo export, que lo retira antes de
 * escribir el suyo.
 */
export const shareExportNatively = async (
  json: string,
  filename: string,
  deps: NativeExportDeps,
  { removeAfterShare }: { removeAfterShare: boolean },
): Promise<void> => {
  const report = (error: unknown) => {
    try {
      deps.onError?.(error);
    } catch {
      // Un reporter roto no puede impedir el export.
    }
  };

  let file: PreparedFile | null = null;

  try {
    if (await deps.canShareFiles()) {
      file = deps.prepareFile(filename, json);
    }
  } catch (error) {
    report(error);
    file = null;
  }

  if (file) {
    try {
      await deps.shareFile(file.uri, filename);
      if (removeAfterShare) removeQuietly(file, report);
      return;
    } catch (error) {
      report(error);
      removeQuietly(file, report);
    }
  }

  await deps.shareMessage(filename, json);
};
