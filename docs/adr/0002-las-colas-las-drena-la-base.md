# 0002 · Las colas de push y correo las drena la propia base

**Estado:** aceptada · 2026-09-29

## Contexto

Push y correo se encolaban (`push_outbox`, `email_outbox`) y no los drenaba
nada en ningún entorno: ni pg_cron creado, ni una llamada a las edge functions,
ni un cron de CI. Solo `npm run push:drain` y `email:drain`, a mano. El
`cron.schedule` de la migración de correo solo corría si pg_cron ya existía.

## Decisión

- pg_cron llama cada minuto a `run_queue_drains()`, que invoca `send-email` o
  `send-intercession-push` por pg_net **solo si hay algo pendiente**; cada 15
  minutos, a `run_email_jobs()`; cada noche, a `purge_expired_rows()`.
- Todo cuelga de `scheduler_settings.enabled`, **apagado** por defecto: las
  suites SQL y los e2e no pueden tener un cron moviendo las colas por debajo.
- La URL de las funciones va en `scheduler_settings.functions_url` y los
  secretos de invocación en Vault (`ammen_email_invoke_secret`,
  `ammen_push_invoke_secret`), por entorno y nunca en una migración.
- Retención: correo 90 días, eventos de Resend 180, push 30, historial de cron 7. `generation_ledger` no se purga: la cuota de planes cuenta sus filas de por
  vida.

## Consecuencias

- Encender en staging es un paso de una persona (`docs/runbooks/staging-web.md`).
- Apagar todo sin redeploy: `update public.scheduler_settings set enabled = false`.
- Los drenajes manuales siguen valiendo para depurar.
