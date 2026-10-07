# Checklist — Deploy a Staging (Fase 1)

**Proyecto:** `ammen-staging` (Firebase) / `syprzdjznuppckenuaua` (Supabase)  
**Objetivo:** Patchear la fuga de seguridad del chat de círculos  
**Tiempo estimado:** 1-2 horas  
**⚠️ Todo manual — nunca usar CI/agentes para deploys**

---

## A. Pre-requisitos

- [ ] Cuenta GCP logueada: `gcloud auth login`
- [ ] CLI Supabase instalado (v2.110+)
- [ ] `.env.staging.local` creado desde `.env.staging.example`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` puesta en `.env.staging.local`

## B. Base de datos (Supabase)

- [ ] **1.** Restaurar proyecto si sigue pausado (Dashboard → Settings → General)
- [ ] **2.** Backup: `pg_dump` de staging
  ```bash
  npx supabase db dump --project-ref syprzdjznuppckenuaua --data-only --file staging-backup.sql
  ```
- [ ] **3.** Verificar historial de migraciones:
  ```bash
  npx supabase migration list --linked
  ```
  - Si hay `20260909100000`–`20260915100000`: revertirlas
    ```bash
    npx supabase migration repair --linked --status reverted 20260909100000 20260910100000 20260911100000 20260912100000 20260913100000 20260914100000 20260915100000
    ```
  - Si hay `20260908100000` y NO tiene `email_preferences`: revertirla
    ```bash
    npx supabase migration repair --linked --status reverted 20260908100000
    ```
- [ ] **4.** Dry-run y push:
  ```bash
  npx supabase db push --linked --dry-run    # revisar
  npx supabase db push --linked --yes         # aplicar
  ```
- [ ] **5.** Configurar URL de avatares:
  ```sql
  update public.project_settings
    set api_urls = array['https://syprzdjznuppckenuaua.supabase.co'],
        updated_at = now()
    where id;
  select public.clear_foreign_avatar_urls();
  ```
- [ ] **6.** Verificar permisos de funciones (SQL Editor):
  ```sql
  -- Debe devolver 0 filas
  select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in (
        'email_prefs_by_token', 'get_circle_invite_preview', 'get_invite_preview',
        'get_shared_plan_preview', 'plan_today', 'reactivate_email_cadence_by_token',
        'unsubscribe_email_one_click', 'update_email_prefs_by_token');
  ```

## C. Edge Functions y secretos

- [ ] **7.** Pull de secretos:
  ```bash
  npm run secrets:pull
  ```
- [ ] **8.** Verificar secretos de invocación:
  ```bash
  npx supabase secrets list --project-ref syprzdjznuppckenuaua
  ```
  Deben aparecer: `AMMEN_EMAIL_INVOKE_SECRET`, `AMMEN_PUSH_INVOKE_SECRET`
- [ ] **9.** Deploy funciones:
  ```bash
  npx supabase functions deploy send-email --project-ref syprzdjznuppckenuaua --use-api
  npx supabase functions deploy enqueue-emails --project-ref syprzdjznuppckenuaua --use-api
  npx supabase functions deploy send-intercession-push --project-ref syprzdjznuppckenuaua --use-api
  ```
- [ ] **10.** (Si `generate-prayer-plan` necesita Anthropic) Deploy:
  ```bash
  npx supabase functions deploy generate-prayer-plan --project-ref syprzdjznuppckenuaua --use-api
  ```

## D. Colas y scheduler

- [ ] **11.** Verificar cola acumulada:
  ```sql
  select 'email' as cola, template, count(*), min(created_at)
    from public.email_outbox where status = 'pending' group by template
  union all
  select 'push', null, count(*), min(created_at)
    from public.push_outbox where status = 'pending';
  ```
- [ ] **12.** Limpiar filas stale (>1 día):
  ```sql
  select public.skip_stale_queue_rows(interval '1 day');
  ```
- [ ] **13.** Encender scheduler:
  ```sql
  update public.scheduler_settings
    set functions_url = 'https://syprzdjznuppckenuaua.supabase.co/functions/v1',
        enabled = true,
        updated_at = now()
    where id;
  ```
- [ ] **14.** Verificar al minuto siguiente:
  ```sql
  select jobname, status, return_message, start_time from cron.job_run_details
    join cron.job using (jobid) order by start_time desc limit 5;
  select public.run_queue_drains();
  ```

## E. Web (Firebase)

- [ ] **15.** Build:
  ```bash
  npm run verify
  npm run build:web:staging
  npm run csp:check
  ```
- [ ] **16.** Verificar `dist`:
  - No debe contener `localhost:54421` ni `https://ammen.app`
  - Sí debe contener la ref `syprzdjznuppckenuaua` y `ammen-staging.web.app`
- [ ] **17.** Deploy:
  ```bash
  npx firebase-tools deploy --only hosting --project ammen-staging
  ```

## F. Smoke remoto

- [ ] **18.** Verificar cabeceras:
  ```bash
  curl.exe -I https://ammen-staging.web.app/
  curl.exe -I https://ammen-staging.web.app/entrar
  curl.exe -I https://ammen-staging.web.app/p/token-invalido
  curl.exe -I https://ammen-staging.web.app/nueva-contrasena
  ```
  Esperado: HTTP 200, CSP presente, `X-Robots-Tag: noindex, nofollow`
- [ ] **19.** Probar en navegador:
  - Entrar con `prueba@ammen.local` / `ammen1234`
  - Forzar modo Oscuro en Perfil → Apariencia
  - Cambiar foto de perfil
  - Ver avatares
  - Abrir chat de un círculo (Realtime)
  - Generar un plan (Edge Function)
  - Descargar versículo como imagen

## G. Post-deploy

- [ ] **20.** Verificar que la fuga de círculos está cerrada:
  - Salir de un círculo → verificar que ya no puede leer/escribir
- [ ] **21.** Anotar última migración aplicada en `staging-web.md`

---

## Despliegue web (sin cambios DB)

Si solo hay cambios front-end (sin migraciones):

```bash
npm run verify
npm run build:web:staging
npm run csp:check
npx firebase-tools deploy --only hosting --project ammen-staging
```

## Apagar todo (urgencia)

```sql
update public.scheduler_settings set enabled = false where id;
```

## Rollback

- **Hosting:** Firebase Console → Hosting → Release history → Roll back
- **DB:** Migración compensación + `npx supabase db push --linked --yes`
