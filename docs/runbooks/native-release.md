# Runbook — lote nativo (Oleada 6) y release nativa

> Estado: **código IMPLEMENTED y cubierto por unitarios; nada verificado en
> dispositivo.** Este entorno no tiene simulador, teléfono ni cuenta de EAS.
> Cada pieza de abajo está partida en lógica pura (probada en Vitest con
> dependencias falsas) y un pegamento nativo fino que **nadie ha ejecutado
> todavía**. La lista de comprobaciones de la sección 3 es lo que falta para
> darlo por bueno.

## 1. Qué entra en el lote

| Pieza                | Dónde                                                        | Qué hace                                                                                                                                                                                                                                                                                                               | Si falla, degrada a…                                                      |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Sesión en el llavero | `core/native/secureSessionStorage.ts`, `utils/supabase.ts`   | En nativo la sesión de Supabase va a `expo-secure-store` en trozos de ≤1800 bytes (dos ranuras + manifiesto que se escribe al final). La sesión antigua de AsyncStorage se migra sola al primer arranque. Web sigue en `localStorage`.                                                                                 | AsyncStorage, como antes. Un cierre de sesión nunca falla por el llavero. |
| Red en React Query   | `core/query/online.ts`, 2 líneas en `app/_layout.tsx`        | NetInfo alimenta `onlineManager`: sin red las queries se pausan y al volver se reanudan. `isInternetReachable === null` cuenta como en línea.                                                                                                                                                                          | Siempre en línea (lo de antes).                                           |
| Copiar enlace        | `core/share.ts`                                              | `copyText`/`canCopyText` con `expo-clipboard` en nativo. «Copiar el enlace» de compartir plan aparece ahora también en el teléfono.                                                                                                                                                                                    | Devuelve `false` y el toast dice error.                                   |
| Exportar mis datos   | `core/legal/exportFile.ts`, `core/legal/export.ts`           | En nativo escribe `ammen-mis-datos-AAAA-MM-DD.json` en la caché (`expo-file-system`, API `File`/`Directory`/`Paths`) y lo comparte con `expo-sharing` (`application/json`, UTI `public.json`). iOS lo borra al cerrar la hoja; Android lo deja en la caché privada hasta el próximo export. Web: descarga, como antes. | El `Share.share` de texto de antes (que falla por encima de ~1 MB).       |
| Destinos del push    | `core/notifications/resolveTarget.ts`                        | Sin cambio de comportamiento: hoy solo existen la intercesión remota y el recordatorio local. Queda escrito cómo se añadiría otro destino sin romper el contrato.                                                                                                                                                      | —                                                                         |
| Build                | `eas.json`, `app.config.js`, `core/native/universalLinks.js` | Fuera los `channel` (sin `expo-updates` no hacían nada). Universal links solo si existe `EXPO_PUBLIC_UNIVERSAL_LINK_HOST`.                                                                                                                                                                                             | Sin la variable, config idéntica a la de antes.                           |
| Crisis por país      | `core/crisis/resources.ts`, `app/crisis.tsx`                 | Línea del país del dispositivo, España si la app está en español, y «Otros países» (findahelpline.com + 112/911).                                                                                                                                                                                                      | Sin región: España (si es) y el buscador.                                 |

## 2. Esto exige un binario nuevo

- El lote añade módulos nativos: `expo-secure-store`, `expo-clipboard`,
  `expo-file-system` y `@react-native-community/netinfo`. **No llega por OTA**
  (no hay `expo-updates`, ver §5): hace falta `eas build` nuevo para
  development, preview y production.
- Un dev client construido antes de este lote **no arranca** con este JS
  («Cannot find native module 'ExpoSecureStore'» / `RNCNetInfo`): se importan
  al arrancar. Es el comportamiento normal de Expo con módulos nativos
  nuevos; la solución es reconstruir el dev client, no degradar.
- Expo Go de SDK 56 debería traer los cuatro módulos; compruébalo antes de
  usarlo para probar.
- `expo-secure-store` va sin su config plugin a propósito: solo añade reglas
  de Auto Backup (Android ya tiene `allowBackup: false`) y un texto de Face
  ID que no usamos.

## 3. Comprobaciones manuales en dispositivo (dueño)

Todas en **iOS y Android**, sobre un build de este lote. Ninguna se ha hecho.

**Sesión (llavero)**

- [ ] Login → matar la app → abrir: sigue la sesión.
- [ ] Logout → matar la app → abrir: pide login (no queda sesión en el
      llavero).
- [ ] Migración: instalar el build **anterior**, hacer login, actualizar a
      este build **sin desinstalar**, abrir: sigue la sesión sin pedir login;
      y sigue en el segundo arranque (ya desde el llavero).
- [ ] Refresco de token: dejar la app más de una hora (o caducar la sesión)
      y volver: sigue funcionando sin pedir login.
- [ ] iOS: reiniciar el teléfono y abrir la app tras desbloquear: sigue la
      sesión.
- [ ] Con un build de desarrollo, ningún aviso `session storage: … degraded`
      en la consola durante lo anterior.

**Red**

- [ ] Con datos en pantalla, modo avión → navegar: sin errores en bucle
      (queries pausadas) → quitar el modo avión: se refresca solo.

**Copiar enlace**

- [ ] Compartir plan → «Copiar el enlace» aparece → toca → toast «Enlace
      copiado» → pegar en otra app: es el enlace.

**Exportar mis datos**

- [ ] Con una cuenta de más de 1 MB de datos: «Descargar mis datos» abre la
      hoja con un fichero `ammen-mis-datos-AAAA-MM-DD.json`.
- [ ] Guardarlo en Archivos (iOS) / Drive (Android) y abrirlo: JSON completo.
- [ ] Android: subir a Drive termina bien (el fichero se queda en caché a
      propósito; si Drive fallara, es que lee más tarde de lo previsto).

**Push**

- [ ] Intercesión con la app cerrada, en segundo plano y en primer plano:
      el tap abre Avisos.
- [ ] Recordatorio diario: el tap abre Hoy.

**Crisis**

- [ ] Con la región del teléfono en España, Estados Unidos, México,
      Argentina y Alemania: el orden y los números son los esperados, los
      botones abren el marcador y «Buscar una línea de ayuda» abre el
      navegador.

**Universal links** (solo cuando exista el dominio, §6)

- [ ] Un enlace `/p/…` y otro `/c/…` desde Mensajes/Correo/WhatsApp abren la
      app, no el navegador; `/persona/…` sigue abriendo el navegador.

## 4. Variables de EAS por entorno

`eas.json` no lleva valores. El dueño define estas variables en los entornos
de EAS (development / preview / production) desde expo.dev o con
`eas env:create`:

| Variable                          | Obligatoria | Qué es                                                                                                      |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`        | Sí          | URL del proyecto Supabase de ese entorno. Sin ella la app lanza al arrancar (`utils/supabase.ts`).          |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Sí          | La anon key de ese proyecto. Es pública por diseño (va en el bundle). **Nunca** la `service_role`.          |
| `EXPO_PUBLIC_APP_URL`             | Sí          | El dominio web de los enlaces que se comparten. Sin ella, nativo usa `https://ammen.app` (`core/share.ts`). |
| `EAS_PROJECT_ID`                  | Para push   | El `projectId` de EAS (`app.config.js` → `extra.eas.projectId`); sin él no hay token de push.               |
| `EXPO_PUBLIC_UNIVERSAL_LINK_HOST` | No          | Solo cuando el dominio esté decidido y sirva los ficheros de §6.                                            |

- Todo `EXPO_PUBLIC_*` acaba dentro del bundle: visibilidad «plain text» o
  «sensitive» en EAS, nunca algo que deba ser secreto.
- Cada perfil tiene que leer su entorno. Con eas-cli reciente se hace con la
  clave `environment` del perfil en `eas.json`; no se ha añadido porque este
  repo declara `cli.version >= 13` y no se ha podido comprobar qué versión la
  admite. Compruébalo y añádela entonces.
- `.env.example` no lista todavía `EXPO_PUBLIC_UNIVERSAL_LINK_HOST` (este
  lote no toca `.env*`).

## 5. Decisión pendiente: `expo-updates`

`eas.json` declaraba `channel` en preview y production, pero `expo-updates`
no está instalado: los canales no hacían nada y se han quitado. Opciones:

1. **Sin OTA (lo de hoy).** Cada arreglo de JS es un build nuevo y una
   revisión de tienda. Lo más simple; ningún riesgo de runtime.
2. **Con `expo-updates`.** Instalarlo (nuevo binario), fijar
   `runtimeVersion` (p. ej. política `fingerprint`, para que un cambio nativo
   no reciba un JS incompatible) y devolver `channel` a cada perfil. Obliga a
   decidir quién publica updates y cómo se revierten.

## 6. Universal links (dominio pendiente)

Decisión del dueño. Pasos cuando haya dominio:

1. Elegir host. Debe ser el mismo que `EXPO_PUBLIC_APP_URL`, porque los
   enlaces compartidos salen de ahí.
2. Copiar las plantillas de `docs/runbooks/universal-links/` a
   `public/.well-known/apple-app-site-association` (sin extensión) y
   `public/.well-known/assetlinks.json`, sustituyendo `REPLACE_WITH_TEAM_ID`
   (Team ID de Apple) y `REPLACE_WITH_SHA256` (huella SHA-256 del
   certificado de firma de Play App Signing; añade también la del keystore de
   EAS si quieres que verifiquen los builds internos). Las plantillas están
   fuera de `public/` para que no se sirvan valores falsos.
3. **Firebase Hosting:** `firebase.json` ignora `**/.*`, así que hoy
   `.well-known` **no se desplegaría**; hay que ajustar ese `ignore`. Añadir
   `Content-Type: application/json` para `/.well-known/apple-app-site-association`,
   sin redirecciones. Comprobar que `expo export` copia `.well-known` a
   `dist/`.
4. Definir `EXPO_PUBLIC_UNIVERSAL_LINK_HOST` en el entorno de EAS y hacer
   build nuevo: `app.config.js` añade `ios.associatedDomains` y un
   `intentFilter` `autoVerify` https para `/p/` y `/c/`.
5. Verificar: CDN de Apple
   (`https://app-site-association.cdn-apple.com/a/v1/<host>`) y en Android
   `adb shell pm get-app-links app.ammen.ammen`.
6. Decidir si entran más rutas (las invitaciones `/i/…`, por ejemplo): se
   añaden en `core/native/universalLinks.js` y en el AASA a la vez.

## 7. Cuentas que hacen falta

- **EAS**: proyecto (`eas init` → `EAS_PROJECT_ID`) y créditos de build iOS.
- **Apple Developer Program**: Team ID, bundle `app.ammen.ammen`, clave APNs
  para Expo push; la capability de Associated Domains la gestiona EAS a
  partir de la config.
- **Google Play Console**: paquete `app.ammen.ammen`, Play App Signing (su
  SHA-256 va en `assetlinks.json`) y credenciales FCM v1 subidas a EAS para
  el push.

## 8. Riesgos y decisiones abiertas

- **iOS conserva el llavero al desinstalar.** Reinstalar la app puede
  devolver la sesión anterior. Si no se quiere, se puede purgar el llavero en
  el primer arranque con una marca en AsyncStorage (que sí se borra al
  desinstalar). No se ha hecho: es una decisión de producto.
- **Falsos «sin internet».** En redes que bloquean la comprobación de
  conectividad del sistema, NetInfo puede decir `isInternetReachable: false`
  con red buena y React Query pausaría las queries. Si se ve en campo, la
  salida es mirar solo `isConnected` en `core/query/online.ts`.
- **Export en Android** queda en la caché privada hasta el próximo export;
  el cierre de sesión no lo borra (el código de sesión es de otro dominio).
- **Crisis**: tabla pendiente de especialista (`docs/runbooks/crisis-es-en.md`);
  el 135 de Argentina solo funciona desde CABA/GBA y no atiende 24 h. La
  baseline visual `crisis` cambia con este lote y hay que regenerarla; además
  depende de la región del navegador de Playwright, que no está fijada en
  `playwright.config.ts`.
- La caché en memoria del adaptador de sesión supone que no hay otro
  contexto JS escribiendo la sesión (no hay tareas en segundo plano con JS
  propio hoy). Si algún día las hay, revisar.
