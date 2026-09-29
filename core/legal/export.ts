import { useMutation } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

import { supabase } from "@/utils/supabase";

import {
  EXPORT_MIME_TYPE,
  EXPORT_UTI,
  exportDeliveryFor,
  exportFilename,
  type NativeExportDeps,
  shareExportNatively,
} from "./exportFile";

/**
 * Llevarte tus datos.
 *
 * La otra mitad del derecho que `delete_my_account` cubría a medias: se podía
 * borrar todo y no se podía sacar nada. Para el RGPD son dos derechos distintos
 * —acceso y supresión— y hasta hoy solo existía el segundo.
 *
 * **En web se descarga; en nativo se comparte un fichero.** En web «guardar
 * un fichero» significa descargarlo, y en un móvil significa elegir a qué app
 * va. El fichero pasa por la caché de la app (`core/legal/exportFile.ts`
 * cuenta por qué ya no va como texto).
 */

/** Una carpeta propia en la caché: así el export anterior se retira entero. */
const EXPORT_DIRECTORY = "ammen-export";

const nativeExportDeps: NativeExportDeps = {
  prepareFile: (name, contents) => {
    const directory = new Directory(Paths.cache, EXPORT_DIRECTORY);

    if (directory.exists) directory.delete();
    directory.create({ intermediates: true, idempotent: true });

    const file = new File(directory, name);

    file.write(contents);

    return {
      uri: file.uri,
      remove: () => {
        if (directory.exists) directory.delete();
      },
    };
  },
  canShareFiles: () => Sharing.isAvailableAsync(),
  shareFile: (uri, name) =>
    Sharing.shareAsync(uri, {
      mimeType: EXPORT_MIME_TYPE,
      UTI: EXPORT_UTI,
      dialogTitle: name,
    }),
  shareMessage: async (title, message) => {
    await Share.share({ title, message });
  },
  onError: (error) => {
    // Solo en desarrollo: ningún reporte lleva el mensaje del error (ADR 0004).
    if (__DEV__) console.warn("export: file share degraded", error);
  },
};

export const useExportMyData = () =>
  useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("export_my_data");

      if (error) throw error;

      const json = JSON.stringify(data, null, 2);
      const filename = exportFilename();

      if (
        exportDeliveryFor(Platform.OS, typeof document !== "undefined") ===
        "download"
      ) {
        const url = URL.createObjectURL(
          new Blob([json], { type: EXPORT_MIME_TYPE }),
        );
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Sin esto el blob se queda en memoria hasta que se recarga la página,
        // y este fichero no es pequeño.
        URL.revokeObjectURL(url);

        return "downloaded" as const;
      }

      await shareExportNatively(json, filename, nativeExportDeps, {
        removeAfterShare: Platform.OS === "ios",
      });

      return "shared" as const;
    },
  });
