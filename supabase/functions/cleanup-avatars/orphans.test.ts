import { describe, expect, it } from "vitest";

import { avatarNameFromUrl, findOrphanAvatars } from "./orphans.ts";

describe("findOrphanAvatars", () => {
  it("una cuenta borrada deja su carpeta entera huérfana", () => {
    const orphans = findOrphanAvatars({
      objects: [
        { name: "ghost-1/avatar.jpg" },
        { name: "ghost-1/avatar.png" },
        { name: "alive-1/avatar.jpg" },
      ],
      accounts: [{ userId: "alive-1", referencedName: "alive-1/avatar.jpg" }],
    });
    expect(orphans).toEqual(["ghost-1/avatar.jpg", "ghost-1/avatar.png"]);
  });

  it("cambiar de extensión huérfana deja la foto vieja", () => {
    const orphans = findOrphanAvatars({
      objects: [{ name: "u1/avatar.jpg" }, { name: "u1/avatar.png" }],
      accounts: [{ userId: "u1", referencedName: "u1/avatar.jpg" }],
    });
    expect(orphans).toEqual(["u1/avatar.png"]);
  });

  it("una cuenta sin avatar no protege ningún fichero", () => {
    const orphans = findOrphanAvatars({
      objects: [{ name: "u2/avatar.webp" }],
      accounts: [{ userId: "u2", referencedName: null }],
    });
    expect(orphans).toEqual(["u2/avatar.webp"]);
  });

  it("no toca lo que no es un avatar: sin carpeta de usuario", () => {
    const orphans = findOrphanAvatars({
      objects: [{ name: "sin-carpeta.jpg" }, { name: "/avatar.jpg" }],
      accounts: [],
    });
    expect(orphans).toEqual([]);
  });

  it("sin cuentas ni ficheros, sin huérfanos", () => {
    expect(findOrphanAvatars({ objects: [], accounts: [] })).toEqual([]);
  });
});

describe("avatarNameFromUrl", () => {
  it("saca la ruta del bucket de la URL pública, con cache-busting", () => {
    expect(
      avatarNameFromUrl(
        "https://proj.supabase.co/storage/v1/object/public/avatars/u1/avatar.jpg?v=123",
      ),
    ).toBe("u1/avatar.jpg");
  });

  it("entiende la URL local de desarrollo", () => {
    expect(
      avatarNameFromUrl(
        "http://127.0.0.1:54421/storage/v1/object/public/avatars/u1/avatar.png",
      ),
    ).toBe("u1/avatar.png");
  });

  it("no entiende lo que no es este bucket", () => {
    expect(avatarNameFromUrl(null)).toBeNull();
    expect(
      avatarNameFromUrl(
        "https://proj.supabase.co/storage/v1/object/public/otro-bucket/u1/x.jpg",
      ),
    ).toBeNull();
    // /avatars/ sin carpeta de usuario: no es un avatar
    expect(
      avatarNameFromUrl(
        "https://proj.supabase.co/storage/v1/object/public/avatars/suelto.jpg",
      ),
    ).toBeNull();
  });
});
