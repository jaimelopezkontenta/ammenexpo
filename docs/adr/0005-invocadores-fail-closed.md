# 0005 · Los drenajes de colas fallan cerrados fuera de local

**Estado:** aceptada · 2026-09-29

## Contexto

`send-email`, `enqueue-emails` y `send-intercession-push` llevan
`verify_jwt = false` (la anon key es pública, no protege nada): lo único que los
guarda es el header `x-ammen-invoker` contra un secreto compartido. Sin secreto
configurado, el header no se exigía, así que un despliegue al que se le olvidara
quedaba abierto a cualquiera, con capacidad de mandar correo con la marca.

## Decisión

- `authorizeInvoker` (`supabase/functions/_shared/invoker.ts`, una sola copia)
  devuelve `unauthorized` sin secreto salvo que `SUPABASE_URL` sea `http://`
  (local); comparación en tiempo constante.
- `enqueue_invite_email` limita por remitente (10 al día, 3 si la cuenta tiene
  menos de 24 h) y en global (200 por hora), y solo con onboarding hecho.

## Consecuencias

- `AMMEN_EMAIL_INVOKE_SECRET` y `AMMEN_PUSH_INVOKE_SECRET` son **obligatorios**
  fuera de local; sin ellos toda llamada da 401. El programador los lee de Vault.
- Confiar en el esquema de `SUPABASE_URL` es una heurística: una URL `http://`
  en un despliegue real dejaría el invocador abierto. Está sometida a revisión
  (ver la revisión de septiembre en `docs/auditoria-2026-09.md`).
