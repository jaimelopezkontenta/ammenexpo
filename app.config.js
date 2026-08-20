/**
 * RDY-13 corrección — `projectId` de EAS, sin secreto hardcodeado.
 *
 * `app.json` (estático) no puede leer variables de entorno; `extra.eas.projectId`
 * tenía que quedar o bien ausente (lo que rompe `getExpoPushTokenAsync()` en
 * un build real de EAS, que sí lo exige) o bien con un valor puesto a mano
 * en el repositorio — y un `projectId` de un proyecto EAS real identifica una
 * cuenta concreta; no es información que deba vivir en texto plano en git
 * como si fuera un dato cualquiera del `app.json`, aunque técnicamente no
 * sea secreta.
 *
 * Este archivo convierte la config a dinámica y lee `EAS_PROJECT_ID` del
 * entorno en tiempo de build/arranque (`.env`, `eas.json` → `env`, o el
 * shell de CI/CD) — nunca de un valor fijo en el repositorio. Si no está
 * puesta, `extra.eas.projectId` queda `undefined`, que es exactamente lo que
 * ya hacía antes de este archivo: local/web sigue funcionando igual que
 * siempre, y `core/notifications/push.ts` ya trata esa ausencia como un caso
 * válido, no como un error.
 *
 * **Esto NO acredita un build de EAS.** Sin login de EAS en este entorno, no
 * hay manera de generar un `projectId` real ni de correr `eas build`. Sigue
 * quedando PENDING — este archivo es el mecanismo, documentado, para cuando
 * alguien con acceso a EAS lo use; no una prueba de que ya se ejecutó.
 */

/** @param {import('@expo/config').ConfigContext} context */
module.exports = ({ config }) => {
  const projectId = process.env.EAS_PROJECT_ID;

  return {
    ...config,
    name: "Ammen",
    slug: "ammen",
    version: "1.0.0",
    scheme: "ammen",
    platforms: ["ios", "android", "web"],
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash.png",
          backgroundColor: "#FFF6EA",
        },
      ],
      "expo-localization",
      "expo-image",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Ammen necesita acceso a tus fotos para poner tu foto de perfil.",
          cameraPermission: false,
        },
      ],
      "expo-sharing",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#B24A22",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      tsconfigPaths: true,
    },
    orientation: "portrait",
    icon: "./assets/icon.png",
    // Solo clara, a propósito. El anochecer existe como capa preparada
    // (colorsDark en theme/tokens.js, medida y congelada en
    // theme/contrast.test.ts) pero está apagado: activar es "automatic" aquí
    // + reencender useThemeColors/useIsDark y el bloque dark del plugin de
    // tailwind.config.
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.ammen.ammen",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFF6EA",
      },
      package: "app.ammen.ammen",
      // Supabase local es http://. Sin esto Android 9+ bloquea el login
      // en el emulador. En producción la URL es https y no se usa.
      usesCleartextTraffic: true,
    },
    // Solo se declara `extra.eas` cuando hay un projectId de verdad que
    // poner — un objeto `{ eas: { projectId: undefined } }` no es lo mismo
    // que no tener la clave, y algunas herramientas de Expo comprueban la
    // presencia de la clave, no solo su valor.
    ...(projectId ? { extra: { eas: { projectId } } } : {}),
  };
};
