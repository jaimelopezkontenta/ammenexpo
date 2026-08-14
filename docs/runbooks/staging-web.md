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

Mantener el sender apagado y desplegarlo con proyecto explícito:

```powershell
npx supabase secrets set PUSH_SENDER_ENABLED=false --project-ref syprzdjznuppckenuaua
npx supabase functions deploy send-intercession-push --project-ref syprzdjznuppckenuaua --use-api
```

`generate-prayer-plan` necesita una clave real de Anthropic. Para cargarla sin
dejar el valor en el historial, crear el archivo local ignorado
`supabase/functions/.env.staging.local` con:

```dotenv
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=<valor-real>
```

Después ejecutar y borrar el archivo local:

```powershell
npx supabase secrets set --env-file supabase/functions/.env.staging.local --project-ref syprzdjznuppckenuaua
npx supabase functions deploy generate-prayer-plan --project-ref syprzdjznuppckenuaua --use-api
Remove-Item supabase/functions/.env.staging.local
```

No inventar, imprimir ni versionar `ANTHROPIC_API_KEY`.

## Build y deploy

```powershell
npm run verify
npm run build:web:staging
npx firebase-tools deploy --only hosting --project ammen-staging
```

`npm run deploy:web:staging` agrupa los dos últimos pasos. Antes del deploy,
buscar en `dist` que no haya `localhost:54421` ni el fallback
`https://ammen.app`, y comprobar que sí aparezcan la ref de Supabase y
`https://ammen-staging.web.app`.

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

## Rollback

- **Hosting:** Firebase Console → proyecto `ammen-staging` → Hosting → Release
  history → menú de la release anterior → **Roll back**. Alternativamente,
  reconstruir un checkout conocido y desplegarlo con
  `firebase deploy --only hosting --project ammen-staging`.
- **DB:** no reset ni rollback destructivo remoto. Crear una migración nueva
  de compensación, probarla localmente y aplicar forward-fix con
  `npx supabase db push --linked --yes`.
