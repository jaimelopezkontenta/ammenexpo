# Runbook — staging web

## Recursos fijos

- GCP/Firebase: `ammen-staging` (`https://ammen-staging.web.app`).
- Firebase Hosting site: `ammen-staging`.
- Supabase: `syprzdjznuppckenuaua`, región `us-east-2`.
- Billing esperado: `01A44B-DFA3DF-DD45B3` (Datzit Payment).

Estado del primer deploy (2026-08-07): Firebase/Hosting, billing, migraciones,
Auth y `send-intercession-push` están provisionados. Solo
`generate-prayer-plan` sigue pendiente por ausencia de `ANTHROPIC_API_KEY`.

Todos los comandos Firebase/GCP durables deben llevar el proyecto explícito.
No usar nunca `trabaja-la` ni otro proyecto. Para Supabase remoto, no ejecutar
`db reset --linked`, no ejecutar seeds y aplicar cambios de DB solo con
`db push`.

El proyecto por defecto de `gcloud` en esta máquina sigue siendo `trabaja-la`.
No se cambia globalmente: cada comando sobre staging lleva
`--project=ammen-staging` (o el ID posicional explícito en comandos que no
aceptan ese flag, como `firebase projects:create`).

## Provisión y enlace

La creación inicial se hizo sin `firebase init`:

```powershell
firebase projects:create ammen-staging --display-name "Ammen Staging" --json
npx supabase link --project-ref syprzdjznuppckenuaua
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked --yes
```

Antes de asociar billing, confirmar la cuenta activa y hacerlo siempre con el
ID explícito:

```powershell
gcloud auth login
gcloud billing accounts list --filter="name=01A44B-DFA3DF-DD45B3"
gcloud billing projects link ammen-staging --billing-account=01A44B-DFA3DF-DD45B3 --project=ammen-staging
```

La asociación de billing no es necesaria para el deploy inicial de Hosting en
el tier gratuito.

## Entorno local de build

`.env.staging.local` está ignorado por git. Crearlo desde el ejemplo y obtener
la clave pública sin copiar ninguna clave `service_role` o secret:

```powershell
Copy-Item .env.staging.example .env.staging.local
npx supabase projects api-keys --project-ref syprzdjznuppckenuaua --output json
```

Poner la clave de tipo `publishable` (o la legacy `anon`) únicamente en
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. No poner aquí contraseñas de DB,
`service_role` ni claves de Anthropic.

## Auth remoto

La configuración se aplicó con `supabase config push` usando temporalmente los
valores staging (el `config.toml` versionado conserva los valores locales):

Validar en **Supabase Dashboard → ammen-staging → Authentication → URL
Configuration**:

- Site URL: `https://ammen-staging.web.app`
- Redirect URL adicional, exacta y sin wildcard:
  `https://ammen-staging.web.app/nueva-contrasena`

Validar en **Authentication → Sign In / Providers → Email**:

- Password mínimo: 8 caracteres.
- Confirm email: desactivado en staging por ahora. La pantalla de alta actual
  presupone una sesión inmediata; activarlo requiere adaptar y probar primero
  `app/(auth)/crear-cuenta.tsx`.

Es la única ruta usada hoy por `redirectTo`: la llama
`resetPasswordForEmail()` desde `app/(auth)/recuperar.tsx`. Si se añade OAuth,
magic link u otro callback, añadir su URL exacta y una prueba antes del deploy;
no recuperar el wildcard `/**`.

Supabase acepta por diseño cualquier path del mismo scheme/host/port que el
`site_url`; la lista adicional no funciona como deny-list de paths same-origin.
Aquí «exacta» significa que solo se configura la ruta que la app usa y ningún
wildcard u origen adicional.

Evidencia remota: Admin `generate_link` conservó el path tanto en
`properties.redirect_to` como en `action_link`; consumir el enlace devolvió
`303` al path exacto, la sesión permitió cambiar la contraseña y la cuenta
probe se eliminó. Una URL de otro origen se normalizó al `site_url`. La prueba
de contraseña corta devolvió `422` y Auth publicó `mailer_autoconfirm=true`.
No crear ni reutilizar cuentas seed en remoto.

## Edge Functions y secrets

La fuente de verdad de las claves de Edge (Resend, Anthropic, invoke
secrets, kill switches) es **Google Cloud Secret Manager** en
`ammen-staging`. No pegarlas en el dashboard de Supabase ni dejarlas en el
historial: `docs/runbooks/secrets-sync.md`.

```powershell
npm run secrets:pull
npx supabase functions deploy send-intercession-push --project-ref syprzdjznuppckenuaua --use-api
```

`generate-prayer-plan` necesita `ANTHROPIC_API_KEY` ya creado en Secret
Manager. Tras `npm run secrets:pull`:

```powershell
npx supabase functions deploy generate-prayer-plan --project-ref syprzdjznuppckenuaua --use-api
```

No inventar, imprimir ni versionar `ANTHROPIC_API_KEY`.

## Build y deploy

```powershell
npm run verify
npm run build:web:staging
npm run csp:check
npx firebase-tools deploy --only hosting --project ammen-staging
```

`npm run deploy:web:staging` agrupa el build y el deploy, **sin** `csp:check`:
si se usa, lanzar `npm run csp:check` entre medias. Antes del deploy,
buscar en `dist` que no haya `localhost:54421` ni el fallback
`https://ammen.app`, y comprobar que sí aparezcan la ref de Supabase y
`https://ammen-staging.web.app`.

### Content-Security-Policy (Oleada 4d, 2026-09-29)

`firebase.json` manda una CSP estricta a todo lo que sirve, junto con
`Strict-Transport-Security` y `Cross-Origin-Opener-Policy: same-origin`. El
porqué de cada directiva está comentado en el propio fichero (firebase-tools
lo lee con comentarios). Lo que hay que saber antes de desplegar:

- `script-src` no admite inline: solo los dos `<script>` del export estático,
  por hash (el del tema de `app/+html.tsx` y la bandera de hidratación de
  Expo Router). `npm run csp:check` recorre cada HTML de `dist` y falla si
  alguno lleva un script inline cuyo hash no está en la CSP; tras subir Expo
  o tocar el script del tema, `npm run csp:hashes` da los hashes nuevos.
- `connect-src` e `img-src` admiten `https://*.supabase.co` (y `wss://` para
  Realtime). **Si la API de Supabase pasa a un dominio propio**, hay que
  añadirlo aquí además de en `project_settings.api_urls`: sin eso la app no
  habla con la base. Igual con cualquier servicio de terceros nuevo
  (analítica, errores, fuentes remotas).
- El e2e de CI sirve el export con estas mismas cabeceras
  (`docs/runbooks/ci.md`, «El e2e estático corre bajo la CSP de producción»),
  pero en modo `single`, sin los scripts inline: los hashes solo se prueban de
  verdad aquí, contra `dist`, y en el smoke.

Rollback de la CSP sin rebuild: quitar la cabecera de `firebase.json` y
desplegar solo hosting (o volver a la release anterior, ver «Rollback»).

## Smoke remoto

```powershell
curl.exe -I https://ammen-staging.web.app/
curl.exe -I https://ammen-staging.web.app/entrar
curl.exe -I https://ammen-staging.web.app/p/token-invalido
curl.exe -I https://ammen-staging.web.app/nueva-contrasena
curl.exe https://ammen-staging.web.app/robots.txt
```

Esperado: HTTP 200 en las cuatro rutas, `X-Robots-Tag` con
`noindex, nofollow`, `robots.txt` con `Disallow: /`, HTML sin cache y assets
fingerprinted con cache immutable. En navegador, Network debe mostrar tráfico
a `syprzdjznuppckenuaua.supabase.co` y ningún request a la instancia local.

CSP: las cuatro rutas traen `Content-Security-Policy`,
`Strict-Transport-Security` y `Cross-Origin-Opener-Policy`. En navegador, con
la consola abierta, ningún «Refused to …» mientras se prueba lo que la CSP
toca: entrar, forzar Oscuro en Perfil → Apariencia y recargar (el script del
tema, sin parpadeo claro), cambiar la foto de perfil (`fetch` de un `blob:` y
subida a Storage), ver avatares, abrir el chat de un círculo (Realtime por
`wss://`), generar un plan (Edge Function) y descargar un versículo como
imagen (html2canvas).

## Migraciones rescatadas (2026-09-29) — antes del próximo `db push`

El 2026-09-29 se rescataron ocho migraciones que solo existían aplicadas en
una base local (`supabase/rescue/2026-09-29/README.md`). Entraron al repo como
`20260929062117_…` a `20260929062124_…`, **idempotentes** (`create or replace`,
`if exists` / `if not exists`), para que valgan tanto si staging nunca las vio
como si alguna vez se le aplicaron con sus versiones originales
(`20260908100000` a `20260915100000`).

Ese día staging estaba **pausado** (`INACTIVE`, plan gratuito) y no se pudo
leer su historial. El próximo push, en este orden:

1. Restaurar el proyecto desde el dashboard si sigue pausado.
2. Copia antes de tocar nada: `pg_dump` de staging (el plan gratuito no tiene
   restauración a un punto en el tiempo).
3. `npx supabase migration list --linked` y mirar la columna remota:
   - **Sin nada posterior a `20260907100000`**: caso normal, seguir al paso 4.
   - **Con `20260909100000`–`20260915100000`** (las versiones originales de las
     rescatadas): marcarlas como revertidas, porque las sustituyen las
     `20260929…` idempotentes:
     `npx supabase migration repair --linked --status reverted 20260909100000 20260910100000 20260911100000 20260912100000 20260913100000 20260914100000 20260915100000`
   - **Con `20260908100000`**: esa versión la comparten `email_lifecycle` (el
     repo) y la `export_personal_collections` rescatada. Cuál se aplicó lo
     dice la tabla, en el SQL Editor:
     `select to_regclass('public.email_preferences') is not null as es_email_lifecycle;`
     - `true` (**con** `email_preferences`): es `email_lifecycle`, la buena.
       No se toca; `db push` la salta y aplica la `20260929062117` rescatada,
       que es idempotente.
     - `false` (**sin** `email_preferences`): era la
       `export_personal_collections` original. Revertirla también, o
       `db push` daría por aplicada `email_lifecycle` sin ejecutarla:
       `npx supabase migration repair --linked --status reverted 20260908100000`
4. `npx supabase db push --linked --dry-run`, revisar la lista y después sin
   `--dry-run`.
5. Anotar aquí la última versión aplicada en staging:
   `20261008101508` (scheduler_calls_api_key), aplicada el 2026-10-09 —
   primer push tras el rescate: 47 migraciones, de `20260908100000`
   (email_lifecycle; la remota era la export_personal_collections original,
   revertida antes del push) hasta la ola del 2026-10-08.

La fuga del chat de círculos (quien sale sigue leyendo) está cerrada en
staging desde el 2026-10-09: `20260929062118_circle_chat_membership` reescribió
`is_conversation_member` para que una `conversation_members` vieja no dé
lectura ni escritura en el chat del círculo. Siempre la base primero y la web
después.

## Programador de colas (Oleada 1b, 2026-09-29)

`20260929074610_queue_scheduler.sql` crea pg_cron, tres trabajos
(`ammen-queue-drains` cada minuto, `ammen-email-jobs` cada 15, `ammen-retention`
a diario) y el interruptor `public.scheduler_settings`, **apagado**. Nada se
envía hasta encenderlo. Tras el `db push` (y los pasos de «Tras el `db push`
de la revisión R1», más abajo):

1. Si la migración falla por permisos al crear `pg_cron`, activarlo antes en
   Dashboard → Database → Extensions y repetir el push.
2. Desplegar las funciones: `send-intercession-push` pasa a `verify_jwt =
   false` (la protege `x-ammen-invoker`, obligatorio fuera de local).
   ```powershell
   npx supabase functions deploy send-email --project-ref syprzdjznuppckenuaua --use-api
   npx supabase functions deploy enqueue-emails --project-ref syprzdjznuppckenuaua --use-api
   npx supabase functions deploy send-intercession-push --project-ref syprzdjznuppckenuaua --use-api
   ```
3. **Antes de seguir**, que las funciones tengan sus secretos de invocación:
   ```powershell
   npx supabase secrets list --project-ref syprzdjznuppckenuaua
   ```
   Tienen que salir `AMMEN_EMAIL_INVOKE_SECRET` y `AMMEN_PUSH_INVOKE_SECRET`.
   Si falta alguno, `npm run secrets:pull` (docs/runbooks/secrets-sync.md):
   sin ellos las funciones rechazan toda llamada con 401.
4. Los mismos valores, en Vault. En el SQL Editor del dashboard, sin
   guardarlos en ningún fichero:
   ```sql
   select vault.create_secret('<valor>', 'ammen_email_invoke_secret');
   select vault.create_secret('<valor>', 'ammen_push_invoke_secret');
   -- Comprobar: dos filas, ninguna vacía.
   select name, length(decrypted_secret) > 0 as tiene_valor
     from vault.decrypted_secrets
    where name in ('ammen_email_invoke_secret', 'ammen_push_invoke_secret');
   ```
   Para **rotar** uno (primero en Secret Manager + `npm run secrets:pull`,
   luego aquí; entre medias las llamadas dan 401 y la cola espera):
   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'ammen_email_invoke_secret'),
     '<valor nuevo>'
   );
   ```
5. **Lo acumulado no se envía de golpe.** Push se encola desde agosto y el
   correo desde septiembre sin que nada lo drenara: el primer minuto encendido
   saldría todo. Mirar qué hay y marcar como `skipped` (motivo `stale`) lo
   pendiente de más de un día, justo antes de encender:
   ```sql
   select 'email' as cola, template, count(*), min(created_at)
     from public.email_outbox where status = 'pending' group by template
   union all
   select 'push', null, count(*), min(created_at)
     from public.push_outbox where status = 'pending';

   select public.skip_stale_queue_rows(interval '1 day');
   ```
6. Encender. **Ojo: `enabled = true` enciende las tres cosas a la vez**: el
   drenaje de colas, los trabajos de correo cada 15 minutos (hábito, digest,
   goteo, win-back: `run_email_jobs`) y la retención nocturna
   (`purge_expired_rows`, que borra correo con fecha de más de 90 días,
   eventos de más de 180, push de más de 30 e historial de cron de más de 7).
   ```sql
   update public.scheduler_settings
      set functions_url = 'https://syprzdjznuppckenuaua.supabase.co/functions/v1',
          enabled = true,
          updated_at = now()
    where id;
   ```
7. Comprobar al minuto siguiente:
   ```sql
   select jobname, status, return_message, start_time from cron.job_run_details
     join cron.job using (jobid) order by start_time desc limit 5;
   select status_code, left(content, 200) from net._http_response
    order by created desc limit 5;
   select public.run_queue_drains();  -- a mano: dice qué llamaría y si falta algo
   ```
   Un 401 es un secreto de Vault que no coincide con el de la función. Si
   falta el secreto en Vault, `run_queue_drains()` y `run_email_jobs()` no
   llaman ni encolan: devuelven `missing_secret` (o `no_functions_url`) y
   dejan un WARNING cada minuto en Dashboard → Logs → Postgres.

Apagarlo todo (colas, trabajos de correo y retención) sin redeploy:
`update public.scheduler_settings set enabled = false where id;`

**Techo de invitaciones por correo.** Con la confirmación de email apagada
(ver «Auth remoto»), el tope por remitente (10 al día, 3 el primer día) se
esquiva creando cuentas; lo que manda entonces es el tope global de
`enqueue_invite_email`: 200 por hora, **4.800 correos de invitación al día**
como mucho, y nunca más de uno por destinatario a la semana. Si Resend avisa
de rebotes o quejas, bajar ese número en una migración o encender la
confirmación de email.

## Tras el `db push` de la revisión R1 (2026-09-29)

Dos pasos a mano, en el SQL Editor, **justo después del push**:

1. **La URL del proyecto para los avatares** (`20260929132147_avatar_url_configurable`).
   Solo se aceptan fotos servidas desde aquí; hasta rellenarlo, **ningún
   avatar nuevo se guarda** (falla cerrado). Después, limpiar los que ya
   apuntaban a otro sitio:
   ```sql
   update public.project_settings
      set api_urls = array['https://syprzdjznuppckenuaua.supabase.co'],
          updated_at = now()
    where id;
   select public.clear_foreign_avatar_urls();  -- cuántas caras se quitaron
   ```
   Tiene que ser exactamente la `EXPO_PUBLIC_SUPABASE_URL` del build (sin
   barra final). Un dominio propio para la API se añade como otro elemento.
2. **Permisos de las funciones** (`20260929132703_function_privileges_anon`).
   Un proyecto creado con los privilegios por defecto antiguos daba EXECUTE
   directo a `anon` sobre cada función nueva; la migración lo normaliza. Las
   tres consultas tienen que devolver lo que dice su comentario:
   ```sql
   -- 0 filas: sin sesión solo se llama a las vistas previas y al correo por token.
   select p.oid::regprocedure
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in (
        'email_prefs_by_token', 'get_circle_invite_preview', 'get_invite_preview',
        'get_shared_plan_preview', 'plan_today', 'reactivate_email_cadence_by_token',
        'unsubscribe_email_one_click', 'update_email_prefs_by_token');

   -- 0 filas: colas, correo y administración, nunca con sesión de usuario.
   select p.oid::regprocedure
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and p.proname in (
        'admin_set_flag', 'admin_set_staff', 'claim_email_outbox_batch',
        'claim_push_outbox_batch', 'email_address_for', 'enqueue_email',
        'ensure_follow', 'issue_email_prefs_token', 'mark_email_delivery',
        'mark_push_delivery', 'pending_push_outbox', 'purge_expired_rows',
        'record_email_event', 'run_email_jobs', 'run_queue_drains',
        'skip_stale_queue_rows', 'verify_email_prefs_token');

   -- {postgres=X/postgres}: las funciones nuevas ya no nacen abiertas.
   select defaclacl from pg_default_acl
    where defaclrole = 'postgres'::regrole
      and defaclnamespace = 'public'::regnamespace
      and defaclobjtype = 'f';
   ```
   La lista completa de funciones cerradas está en `supabase/tests/rls.sql`
   (sección «El catálogo, entero»).

**Tablas con legado en proyectos antiguos** (descubierto en staging,
2026-10-09): los proyectos creados antes del barrido daban `arwd` de tabla
entera a `anon`/`authenticated` y la regla por defecto lo reproducía en cada
tabla nueva. Las migraciones del barrido solo tocan lo que ellas conceden, no
limpian el legado. Arreglo puntual: diff de `relacl` de todas las tablas de
`public` (la local es el estado objetivo) contra el entorno y `revoke` de los
bits de más de `anon`/`authenticated` (en staging, 166 revokes); después,
`alter default privileges ... revoke` hasta que `pg_default_acl` sea idéntico
al de la local (tablas: `postgres=ALL, service_role=Dxtm` y nada para los roles
de API; secuencias: solo UPDATE para estos). Verificar con la consulta de
catálogo del final de `rls.sql` (tiene que salir vacía).

## Secreto de los enlaces de baja, en Vault (Oleada 4b, 2026-09-29)

Los enlaces de preferencias y baja de cada correo van firmados con HMAC. El
secreto vivía en claro en `public.email_runtime.hmac_secret`; desde
`email_hmac_vault` vive en Vault como `ammen_email_hmac_secret`. La migración
lo copia con el **mismo valor** (los enlaces ya enviados siguen valiendo) y
vacía la columna.

**Tras el `db push`**, en el SQL Editor:

```sql
-- Una fila con valor, y la columna vieja vacía.
select name, length(decrypted_secret) >= 32 as tiene_valor
  from vault.decrypted_secrets where name = 'ammen_email_hmac_secret';
select hmac_secret is null as columna_vacia from public.email_runtime;
```

Si la primera no devuelve fila (el push dejó un WARNING «Vault no disponible»),
el secreto sigue en la tabla y los enlaces funcionan igual; en cuanto Vault
responda, repetir el traslado — es idempotente:

```sql
select public.email_hmac_secret_to_vault();  -- 'created' o 'already_in_vault'
```

**Rotar** (si el secreto se filtró): **invalida todos los enlaces de baja ya
enviados** — un enlace viejo deja de abrir las preferencias y de dar de baja;
quien lo pulse tendrá que cambiarlo desde la app o esperar al siguiente correo,
que ya lleva uno nuevo. Nada más se rompe: los correos pendientes se firman al
enviarse, no al encolarse.

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'ammen_email_hmac_secret'),
  encode(extensions.gen_random_bytes(32), 'hex')
);
```

El valor no se copia a ningún sitio (ni Secret Manager ni `.env`): solo lo usa
la base. Nunca borrar el secreto sin rotarlo: sin él y con la columna vacía,
`issue_email_prefs_token` devuelve null y `send-email` envía el correo **sin**
enlace de baja (lo deja en el log como `prefs_token.missing`).

## Rollback

- **Hosting:** Firebase Console → proyecto `ammen-staging` → Hosting → Release
  history → menú de la release anterior → **Roll back**. Alternativamente,
  reconstruir un checkout conocido y desplegarlo con
  `firebase deploy --only hosting --project ammen-staging`.
- **DB:** no reset ni rollback destructivo remoto. Crear una migración nueva
  de compensación, probarla localmente y aplicar forward-fix con
  `npx supabase db push --linked --yes`.
