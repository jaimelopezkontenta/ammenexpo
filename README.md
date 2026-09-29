# Ammen

App de oración en español (y en inglés). El plan lo escribe la IA y se recorre
día a día; el corazón es el bucle social: cuando alguien ora por tu día, tú te
enteras.

Una sola base de Expo para **Android, iOS y web**, con cinco pestañas —Hoy,
Biblia, Orar, Juntos y Perfil— y tema claro y oscuro.

---

## El entorno local

Todo corre en Docker, en tu máquina, sin tocar nada en la nube. `supabase start`
levanta la pila entera:

| Contenedor | Qué es | Puerto |
|---|---|---|
| `supabase_db` | Postgres, con todo el esquema y las policies | `54422` |
| `supabase_kong` | La puerta de entrada — todo pasa por aquí | **`54421`** |
| `supabase_auth` | Cuentas, sesiones, recuperación de contraseña | vía Kong |
| `supabase_rest` | La API sobre las tablas (PostgREST) | vía Kong |
| `supabase_realtime` | Los mensajes del chat en vivo | vía Kong |
| `supabase_storage` | Los ficheros: hoy, los avatares | vía Kong |
| `supabase_edge_runtime` | Las Edge Functions: el plan con Claude, los avisos push y los correos | vía Kong |
| `supabase_studio` | Panel para mirar la base a mano | `54423` |
| `supabase_inbucket` | **Buzón de correo falso**: aquí llegan los emails de alta y de recuperación, sin mandar nada a nadie | `54424` |

No hay ninguna dependencia de un proveedor de nube: lo que corre aquí es lo
mismo que corre en producción, con las mismas migraciones y las mismas policies.

### Arrancar

La primera vez, crea el `.env` a partir de `.env.example`. Tras `db:start`,
`npx supabase status` da la clave anónima local:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
EXPO_PUBLIC_SUPABASE_ANON_KEY=<la anon key de supabase status>
```

Luego, cada vez:

```bash
npm run db:start
```

```bash
npm run doctor
```

```bash
npm run web
```

`db:start` es `supabase start`. `doctor` es de solo lectura y conviene mirarlo
antes de lanzar nada: comprueba que la base esté sana, que Auth responda vía
Kong y que exista la cuenta de prueba, y avisa de procesos de Node que pesan
gigas, del puerto 8081 ocupado por otra cosa y de un `.env.local` con la URL del
emulador. `web` levanta Metro y sirve la app en `http://127.0.0.1:8081`.

Para el teléfono: `npm run android` o `npm run ios`, que compilan una build de
desarrollo nativa.

### La URL de Supabase: `.env` y `.env.local`

El `.env` usa `http://127.0.0.1:54421`, que vale para web. Expo carga
`.env.local` **por encima** de `.env`: si el tuyo apunta a `10.0.2.2:54421` (el
alias del host dentro del emulador Android), el navegador no alcanza Supabase y
todos los logins fallan sin decir por qué.

Para web, quita esa línea de `.env.local` o pisa la variable al arrancar
(PowerShell):

```powershell
$env:EXPO_PUBLIC_SUPABASE_URL="http://127.0.0.1:54421"; npm run web
```

Los e2e no dependen de esto: `playwright.config.ts` fija la URL por su cuenta.

### El emulador Android

En el emulador, `127.0.0.1` es el emulador mismo, no el host. Sin más, la app no
alcanza Supabase y el login muestra "Algo salió mal".

La solución es `adb reverse`, que redirige el puerto del emulador al host sin
tocar ningún `.env`:

```bash
adb reverse tcp:54421 tcp:54421
```

Así `127.0.0.1:54421` funciona igual en web que en el emulador, y no hace falta
`10.0.2.2` en `.env.local`. Solo afecta al desarrollo local; en staging y
producción la URL apunta al Supabase remoto.

### El estado de todo

```bash
npx supabase status
```

### Empezar de cero

Rehace la base desde las migraciones y vuelve a sembrar las cuentas de prueba.
**Borra todo lo demás.**

```bash
npm run db:reset
```

Es `supabase db reset` con un envoltorio: el CLI a veces devuelve un 502 de
Storage al reiniciar contenedores aunque la base ya quedó sembrada, y el
envoltorio distingue ese fallo cosmético de uno real.

### Las cuentas de prueba

`supabase/seed.sql` se ejecuta después de cada `db reset` —y `npm run verify`
hace trece—, así que las cuentas siempre están ahí:

```
prueba@ammen.local  ·  ammen1234
zoe@ammen.local     ·  ammen1234
```

`prueba` viene con el onboarding hecho, los términos aceptados, un plan de
catorce días empezado hace tres, alguien que ya ha orado por el día de hoy y un
círculo con dos personas: sin datos, las cinco pestañas salen vacías y una
pantalla vacía no sirve para revisar un diseño. `zoe` es la otra persona del
círculo, para ver el bucle social desde el otro lado.

Son **solo locales**. `db reset` no se ejecuta jamás contra producción —allí se
hace `db push`, que no toca los seeds—, pero esa contraseña está escrita en el
repositorio: no debe existir una cuenta con ella en ningún otro sitio.

---

## Verificar

```bash
npm run verify
```

Encadena, en este orden: `typecheck`, `lint` (eslint y prettier), los tests de
JavaScript (Vitest) y **trece suites de assertions SQL** que se ejecutan cada
una contra una base recién reseteada — `rls`, `flows`, `streak`, `timezone`,
`bible`, `circles`, `plans`, `storage`, `social`, `flags`, `push`, `generation`
y `email`. Las suites SQL van en serie detrás de un lock (`.tmp/db.lock`) para
que dos corridas no reseteen la misma base, y tardan unos ocho minutos.

Nada se commitea sin esto en verde. CI (`.github/workflows/verify.yml`) corre
lo mismo, más los e2e de Playwright, en cada PR y en cada push a `main`.

### Más allá de `verify`

| Comando | Qué hace |
|---|---|
| `npm run e2e` | Playwright (Chromium) contra Metro. Resetea la base al empezar |
| `npm run e2e:static` | Los mismos e2e contra el export estático, igual que CI |
| `npm run e2e:visual` | Regresión visual, en claro y en oscuro |
| `npm run e2e:visual:update` | Regenera las baselines. Solo tras un cambio visual deliberado, revisando el diff |
| `npm run test:chunks` | La generación por tramos contra la Edge Function servida (necesita `supabase functions serve`) |
| `npm run email:preview` | Renderiza las plantillas de correo a `email-preview/` para mirarlas en el navegador |

---

## Los secretos

`supabase/functions/.env` **está en `.gitignore` y no se sube nunca**. Se crea a
partir de `supabase/functions/.env.example`, que documenta cada variable. La
que más importa es `AI_PROVIDER`, que decide quién escribe los planes:

- `anthropic` (por defecto): Claude. Necesita `ANTHROPIC_API_KEY`.
- `unsloth`: un modelo local servido en el host. Valida la fontanería, no la
  calidad.
- `fixture`: días fijos. Es lo que usan CI y los e2e; nunca en producción.

Los avisos push y los correos tienen interruptor propio (`PUSH_SENDER_ENABLED`,
`EMAIL_SENDER_ENABLED`). En local puede no haber `pg_cron`, así que las colas se
drenan a mano con `npm run push:drain` y `npm run email:drain`.

En remoto no hay fichero: las claves viven en Google Cloud Secret Manager
(`ammen-staging`) y se copian a las Edge Functions con
`npm run secrets:pull`. Ver `docs/runbooks/secrets-sync.md`.

La clave `service_role` no se usa jamás desde el cliente.

---

## Staging

La web de staging vive en https://ammen-staging.web.app (Firebase Hosting,
proyecto `ammen-staging`, contra el Supabase remoto). El build, el deploy, el
smoke y el rollback están en `docs/runbooks/staging-web.md`.

En la base remota los cambios entran solo con `db push`: nunca `db reset`,
nunca seeds.

---

## Cómo está organizado

```
app/          Las pantallas. El enrutado es por sistema de ficheros (Expo Router).
components/   Lo compartido entre pantallas; en ui/, las primitivas (Txt, Tap, Pill…).
core/         Las consultas, el estado y la lógica pura — agrupado por dominio.
theme/        Tokens, degradados y movimiento, en claro y en oscuro.
translation/  es.json y en.json. Las dos tienen que tener exactamente las mismas claves.
supabase/
  migrations/ El esquema. Nunca se edita una migración ya aplicada: se añade otra.
  functions/  Las Edge Functions, en Deno: el plan, los avisos push y los correos.
  templates/  Los correos de Auth (alta, recuperación, cambio de contraseña).
  tests/      Las assertions SQL.
  seed.sql    Las cuentas de prueba.
e2e/          Playwright: flujos, regresión visual y sus baselines.
scripts/      El médico, el lock de la base, los drenajes y la sincronía de secretos.
prototipo/    TOKENS.md: donde quedaron decididos y medidos los valores del diseño.
docs/         Planes, auditorías y runbooks.
```

Antes de tocar UI, lee `AGENTS.md`: es el contrato visual (qué primitiva usar
para cada cosa, cómo funciona el modo oscuro y qué no se puede romper).

### Dos reglas que ya costaron depuración

1. **Una policy de SELECT tiene que poder decidir con las columnas de su propia
   fila.** Si consulta su propia tabla, rompe los `insert ... returning`, y
   Postgres lo reporta igual que un fallo de `WITH CHECK`. Toda tabla nueva
   necesita su assertion de regresión.
2. **Los GRANT son una capa distinta de RLS.** "permission denied for table X"
   no es RLS: es que falta el GRANT.
