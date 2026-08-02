import { useMutation } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import { type RefObject } from "react";
import { Platform, type View } from "react-native";
import { captureRef } from "react-native-view-shot";

/**
 * Compartir el versículo como imagen.
 *
 * Una sola captura para web y para móvil: `captureRef` usa `html2canvas` en el
 * navegador y la API nativa en el teléfono. La alternativa —dibujar en un canvas
 * en web y capturar la vista en nativo— serían dos maquetaciones del mismo
 * diseño, y eso se separa a la tercera vez que alguien toca la tarjeta.
 *
 * **En web se descarga; en móvil va a la hoja de compartir.** Lo mismo que hace
 * el export de datos, y por lo mismo: en el navegador «guardar una imagen»
 * significa descargarla, y en un teléfono significa elegir a qué app va —que
 * aquí es el punto entero, porque el canal es WhatsApp.
 */
export const useShareVerseImage = (ref: RefObject<View | null>) =>
  useMutation({
    mutationFn: async (input: { reference: string }) => {
      if (!ref.current) throw new Error("verse_card_not_mounted");

      const uri = await captureRef(ref, {
        format: "png",
        quality: 1,
        // La tarjeta ya se pinta a 1080; capturar a escala 1 evita una imagen de
        // tres mil píxeles que tarda en subirse por una conexión mala.
        result: Platform.OS === "web" ? "data-uri" : "tmpfile",
      });

      const filename = `${input.reference.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`;

      if (Platform.OS === "web" && typeof document !== "undefined") {
        const link = document.createElement("a");

        link.href = uri;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        return "downloaded" as const;
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("sharing_unavailable");
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: input.reference,
      });

      return "shared" as const;
    },
  });
