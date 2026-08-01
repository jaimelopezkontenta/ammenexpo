import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

/**
 * 512 px es de sobra para una cara de 40 px en pantalla, incluso al triple de
 * densidad, y mantiene el fichero muy por debajo del tope de 2 MiB del bucket
 * sin necesidad de una segunda librería para recomprimir.
 */
const MAX_SIDE = 512;
const QUALITY = 0.7;

export class AvatarTooLarge extends Error {
  constructor() {
    super("avatar_too_large");
    this.name = "AvatarTooLarge";
  }
}

/**
 * Elegir una foto y subirla.
 *
 * La ruta es `{user_id}/avatar.jpg` porque la policy de `storage.objects` saca
 * la carpeta del propio nombre del fichero: sin ese primer segmento, cualquiera
 * con sesión podría escribir sobre la cara de otra persona.
 *
 * `upsert` en vez de un nombre nuevo cada vez: así cambiar de foto no deja
 * ficheros huérfanos que nadie va a borrar nunca.
 */
export const useUploadAvatar = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        throw new Error("avatar_permission_denied");
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        // Cuadrado desde el recorte, para que ninguna pantalla tenga que
        // adivinar cómo encajar un retrato apaisado en un círculo.
        aspect: [1, 1],
        quality: QUALITY,
      });

      if (picked.canceled) return null;

      const asset = picked.assets[0];

      // El bucket rechaza por encima de 2 MiB, y ese rechazo llega como un 400
      // sin explicación. Mejor decirlo antes de subir nada.
      if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
        throw new AvatarTooLarge();
      }

      const response = await fetch(asset.uri);
      const blob = await response.arrayBuffer();

      const extension = asset.mimeType === "image/png" ? "png" : "jpg";
      const path = `${userId!}/avatar.${extension}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, {
          contentType: asset.mimeType ?? "image/jpeg",
          upsert: true,
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      // Un parámetro de cache-busting: la URL pública es la misma después de
      // cambiar de foto, así que sin esto la cara vieja se queda pegada en la
      // caché del dispositivo y del CDN.
      const url = `${publicUrl}?v=${Date.now()}`;

      const { data, error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId!)
        .select("id");

      if (profileError) throw profileError;

      // Cero filas es como RLS rechaza un update: sin error y sin filas.
      if (!data?.length) throw new Error("avatar_update_no_rows");

      return url;
    },
    onSuccess: () => {
      // La cara sale en todas las superficies sociales, y ninguna de ellas
      // refresca al enfocar.
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      void queryClient.invalidateQueries({ queryKey: ["whoPrayedForMe"] });
      void queryClient.invalidateQueries({ queryKey: ["sharedWithMe"] });
      void queryClient.invalidateQueries({ queryKey: ["circleMessages"] });
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
      void queryClient.invalidateQueries({ queryKey: ["testimonies"] });
    },
  });
};

/** Quitarse la foto tiene que poder hacerse, y sin dejar el fichero detrás. */
export const useRemoveAvatar = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await supabase.storage
        .from("avatars")
        .remove([`${userId!}/avatar.jpg`, `${userId!}/avatar.png`]);

      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId!)
        .select("id");

      if (error) throw error;
      if (!data?.length) throw new Error("avatar_update_no_rows");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      void queryClient.invalidateQueries({ queryKey: ["whoPrayedForMe"] });
      void queryClient.invalidateQueries({ queryKey: ["sharedWithMe"] });
      void queryClient.invalidateQueries({ queryKey: ["circleMessages"] });
      void queryClient.invalidateQueries({ queryKey: ["prayerFeed"] });
      void queryClient.invalidateQueries({ queryKey: ["testimonies"] });
    },
  });
};
