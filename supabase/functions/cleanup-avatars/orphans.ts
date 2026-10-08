/**
 * Detección de avatares huérfanos, pura y sin runtime: la entrada es lo que el
 * caller (index.ts) ya haya leído de Supabase, y la salida son las rutas del
 * bucket `avatars` que nadie referencia.
 *
 * Dos formas de huérfano:
 *   1. La cuenta ya no existe: borrarse borra `auth.users`, y el fichero que
 *      el cliente no alcanzó a borrar (o una app vieja que no lo borraba)
 *      queda para siempre.
 *   2. El usuario existe pero el fichero no es su avatar: cambiar de foto con
 *      otra extensión (png → jpg) hace un upsert sobre la otra ruta y deja la
 *      vieja sin referencia.
 *
 * Una cuenta sin avatar (avatar_url null) con un fichero detrás también es el
 * caso 2: el fichero no lo referencia nadie.
 */

export type AvatarObject = {
  /** Ruta dentro del bucket, p. ej. `5eed…/avatar.jpg`. */
  name: string;
};

export type AvatarRef = {
  /** user id del dueño. */
  userId: string;
  /** Ruta referenciada o null si no tiene avatar. */
  referencedName: string | null;
};

export const findOrphanAvatars = (input: {
  objects: readonly AvatarObject[];
  accounts: readonly AvatarRef[];
}): readonly string[] => {
  const byUser = new Map<string, string | null>();
  for (const account of input.accounts) {
    byUser.set(account.userId, account.referencedName);
  }

  const orphans: string[] = [];
  for (const object of input.objects) {
    const slash = object.name.indexOf("/");
    if (slash <= 0) continue; // sin carpeta de usuario: no es un avatar

    const userId = object.name.slice(0, slash);
    const referenced = byUser.get(userId);
    if (referenced !== object.name) {
      orphans.push(object.name);
    }
  }

  return orphans.sort();
};

/**
 * De una URL pública (`…/object/public/avatars/<ruta>?v=123`) a la ruta del
 * bucket. Null si la URL no apunta a este bucket: mejor no entenderla que
 * entenderla mal y borrar lo ajeno.
 */
export const avatarNameFromUrl = (url: string | null): string | null => {
  if (!url) return null;

  const marker = "/avatars/";
  const at = url.indexOf(marker);
  if (at === -1) return null;

  const rest = url.slice(at + marker.length);
  const name = rest.split(/[?#]/, 1)[0];
  return name && name.includes("/") ? name : null;
};
