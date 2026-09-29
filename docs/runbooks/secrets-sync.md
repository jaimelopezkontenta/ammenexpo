# Runbook — secretos de Edge Functions (GCP → Supabase)

GCP Secret Manager es la fuente de verdad. El script
`scripts/secretsSync.mjs` copia esos valores a `supabase secrets set` del
proyecto remoto. No pega claves en el dashboard a mano en cada cambio.

Esto **no** crea la cuenta de Resend, **no** configura DNS y **no** despliega
funciones. Solo mueve secretos que ya existen.

## Recursos fijos (staging)

- GCP/Firebase: `ammen-staging` (el mismo que Hosting; ver `.firebaserc`).
- Supabase: `syprzdjznuppckenuaua`.
- El `gcloud` de esta máquina puede tener otro proyecto por defecto
  (`trabaja-la`). El script **nunca** lo usa: cada llamada lleva
  `--project=ammen-staging`.

Producción aún no está mapeada. Cuando exista: `--gcp-project … --project-ref …`.

## Lo que Jaime hace a mano (una vez)

1. **Resend:** cuenta, dominio, DNS (SPF/DKIM/verificación) y las dos claves
   (`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`).
2. **gcloud:** `gcloud auth login` y acceso al proyecto `ammen-staging`.
3. **API:** `gcloud services enable secretmanager.googleapis.com --project=ammen-staging`
4. **Crear los secretos** en Secret Manager (consola o CLI; ver abajo).
5. **Supabase:** `npx supabase login` (o `SUPABASE_ACCESS_TOKEN`) y el
   proyecto enlazado / el `--project-ref` correcto.
6. **IAM** si otra cuenta necesita correr el script:
   - pull: `roles/secretmanager.secretAccessor`
   - push/seed: además crear secretos y añadir versiones
     (`roles/secretmanager.admin`, o creator + versionAdder).

Anthropic, allowlist, orígenes y kill switches también se crean a mano la
primera vez. El script solo los copia.

## Nombres (mapeo identidad)

El id en Secret Manager **es** el nombre de la variable de la Edge Function.

| GCP Secret Manager | `supabase secrets` |
|---|---|
| `RESEND_API_KEY` | `RESEND_API_KEY` |
| `RESEND_WEBHOOK_SECRET` | `RESEND_WEBHOOK_SECRET` |
| `EMAIL_ALLOWLIST` | `EMAIL_ALLOWLIST` |
| `EMAIL_SENDER_ENABLED` | `EMAIL_SENDER_ENABLED` |
| `EMAIL_APP_ORIGIN` | `EMAIL_APP_ORIGIN` |
| `AMMEN_EMAIL_INVOKE_SECRET` | `AMMEN_EMAIL_INVOKE_SECRET` |
| `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` |
| `PUSH_SENDER_ENABLED` | `PUSH_SENDER_ENABLED` |
| `AMMEN_PUSH_INVOKE_SECRET` | `AMMEN_PUSH_INVOKE_SECRET` |

No se sincronizan (solo local): `UNSLOTH_URL`, `UNSLOTH_MODEL`, `UNSLOTH_API_KEY`.

**`AMMEN_EMAIL_INVOKE_SECRET` y `AMMEN_PUSH_INVOKE_SECRET` son obligatorios
fuera de local** (desde el 2026-09-29): sin ellos, `send-email`,
`enqueue-emails` y `send-intercession-push` rechazan toda llamada con 401
(fail-closed, `supabase/functions/_shared/invoker.ts`). Antes, sin secreto,
no exigían el header y quedaban abiertas a cualquiera.
Supabase inyecta solo `SUPABASE_URL` / `ANON` / `SERVICE_ROLE`; no van aquí.

Valores típicos de staging (no son secretos de marca; sí pasan por Secret
Manager porque las Edge Functions no tienen otro canal de env remoto):

- `EMAIL_SENDER_ENABLED=false` y `PUSH_SENDER_ENABLED=false` hasta abrir envío.
- `EMAIL_APP_ORIGIN=https://ammen-staging.web.app`
- `EMAIL_ALLOWLIST` = correos que pueden recibir en staging.

## Crear los secretos la primera vez

Consola: [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=ammen-staging)
→ Create secret → id = el nombre de la tabla → valor.

CLI (el valor no queda en el historial si entra por stdin; en PowerShell,
evitar `echo` que añade newline de más — preferir un fichero local
gitignored y `push`, o la consola):

```powershell
gcloud secrets create RESEND_API_KEY --replication-policy=automatic --project=ammen-staging
# Luego una versión con el valor, desde la consola, o:
# gcloud secrets versions add RESEND_API_KEY --data-file=CLAVE.txt --project=ammen-staging
```

Repetir para cada fila de la tabla. No commitear `CLAVE.txt`.

## Correr el script

```powershell
npm run secrets:pull
# equivalente: node scripts/secretsSync.mjs pull --env staging
```

Comprueba gcloud, lee los nueve secretos y hace `supabase secrets set`
contra `syprzdjznuppckenuaua`. No imprime valores. Si falta uno, **no escribe
nada** en Supabase.

Otras formas:

```powershell
npm run secrets:sync
node scripts/secretsSync.mjs list
node scripts/secretsSync.mjs pull --only RESEND_API_KEY,EMAIL_ALLOWLIST
node scripts/secretsSync.mjs pull --dry-run
node scripts/secretsSync.mjs pull --gcp-project ammen-staging --project-ref syprzdjznuppckenuaua
```

Variables de entorno equivalentes: `AMMEN_ENV`, `AMMEN_GCP_PROJECT`,
`AMMEN_SUPABASE_PROJECT_REF`. El default de `gcloud config` se ignora.

## Sembrar desde un fichero local (opcional)

El patrón ya existía: `supabase/functions/.env.staging.local` (gitignored).
`push` / `seed` escribe primero en GCP y después hace pull a Supabase.

```powershell
npm run secrets:push -- --env-file supabase/functions/.env.staging.local
```

El fichero no se commitea. Tras un push correcto se puede borrar; GCP queda
como fuente de verdad. `UNSLOTH_*` en ese fichero se omite.

## Fallos esperables

- Sin `gcloud` o sin `gcloud auth login`.
- Proyecto GCP mal escrito / sin permiso / API de Secret Manager apagada.
- Secreto ausente o versión latest vacía → sale 1, Supabase intacto.
- Sin `npx supabase login` o `--project-ref` incorrecto.
- `push` sin `--env-file` y sin `.env.staging.local`.

Tras sincronizar, el deploy de funciones sigue siendo el de siempre:

```powershell
npx supabase functions deploy send-email --project-ref syprzdjznuppckenuaua --use-api
```

Un secreto nuevo en una función ya desplegada no exige redeploy; el runtime
lee el valor en la siguiente invocación.
