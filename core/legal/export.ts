import { useMutation } from "@tanstack/react-query";
import { Platform, Share } from "react-native";

import { supabase } from "@/utils/supabase";

/**
 * Llevarte tus datos.
 *
 * La otra mitad del derecho que `delete_my_account` cubría a medias: se podía
 * borrar todo y no se podía sacar nada. Para el RGPD son dos derechos distintos
 * —acceso y supresión— y hasta hoy solo existía el segundo.
 *
 * **En web se descarga; en nativo se comparte.** No es una inconsistencia: en
 * web «guardar un fichero» significa descargarlo, y en un móvil significa
 * elegir a qué app va. Añadir `expo-file-system` para escribirlo en un
 * directorio que nadie abre nunca sería una dependencia más para un peor
 * resultado.
 */
export const useExportMyData = () =>
  useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("export_my_data");

      if (error) throw error;

      const json = JSON.stringify(data, null, 2);
      const filename = `ammen-${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === "web" && typeof document !== "undefined") {
        const url = URL.createObjectURL(
          new Blob([json], { type: "application/json" }),
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

      await Share.share({ title: filename, message: json });

      return "shared" as const;
    },
  });
