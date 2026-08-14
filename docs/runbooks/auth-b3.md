# Runbook — auth B3: paridad local/staging/producción

> Estado: **local y staging IMPLEMENTED/EVIDENCE-PASS** para contraseña,
> confirmación y redirect de recovery. Producción, SMTP real y builds nativos
> siguen **PENDING**.

## Lo que ya es verdad en local

- `supabase/config.toml`: `minimum_password_length = 8`, alineado con
  `core/auth/validation.ts` (`MIN_PASSWORD_LENGTH = 8`).
- `enable_confirmations = false` para email y phone: sin confirmación en
  local. Staging mantiene hoy esa decisión por compatibilidad con la pantalla
  de alta; producción sigue pendiente de decisión antes de abrir beta.
- Evidencia ejecutada contra la API real:
  - `POST /auth/v1/signup` con clave de 6 caracteres → `422`.
  - `POST /auth/v1/signup` con clave de 8+ caracteres → `200`, sesión emitida.

## Staging remoto

Proyecto: `syprzdjznuppckenuaua`. Configuración aplicada el 2026-08-07:

- `site_url = https://ammen-staging.web.app`
- Redirect URL adicional exacta:
  `https://ammen-staging.web.app/nueva-contrasena`
- Sin wildcard: `https://ammen-staging.web.app/**` se retiró después de
  comprobar que no conservaba el path de recovery en la validación inicial.
- Password mínimo: 8.
- Confirmación de email: desactivada (`mailer_autoconfirm = true`), igual que
  en local. `app/(auth)/crear-cuenta.tsx` aún presupone sesión inmediata.

`app/(auth)/recuperar.tsx` es el único uso actual de `redirectTo` en Auth y
construye exactamente `/nueva-contrasena`. No hay OAuth, magic link ni otro
deep link Auth que necesite otra entrada en la allow-list.

Supabase Auth acepta por diseño cualquier path que comparta scheme, host y
puerto con `site_url`; la allow-list adicional no puede convertir el mismo
origen en una deny-list por path. «Exacta» aquí significa que la configuración
adicional contiene solo la ruta funcional necesaria, sin wildcard ni otros
orígenes. Los redirects a otro origen sí pasan por esa allow-list.

### Evidencia remota no destructiva

Se creó una cuenta probe mediante Admin API, sin enviar correo, y se pidió un
`generateLink({ type: "recovery" })` con el redirect exacto. La prueba comprobó:

- `properties.redirect_to` conserva `/nueva-contrasena`.
- El `redirect_to` incluido en `action_link` conserva el mismo path.
- Consumir el action link responde `303` hacia
  `https://ammen-staging.web.app/nueva-contrasena`.
- La sesión de recovery permitió cambiar la contraseña.
- La cuenta probe se eliminó al terminar, también ante error.
- Un redirect a otro origen (`https://example.net/...`) cae al `site_url`.

La API pública también rechazó una contraseña de 6 caracteres con `422` y
publica `mailer_autoconfirm = true`, que corresponde a confirmación
desactivada.

## Lo que falta decidir y probar antes de la beta (Gate 2)

1. **Confirmación de email en producción.** Si se activa,
   `app/(auth)/crear-cuenta.tsx` tiene que dejar de presuponer sesión
   inmediata tras el alta — hoy asume que `enable_confirmations = false`.
   Revisar esa pantalla en el mismo cambio que se active la confirmación.
2. **SMTP real.** Local usa Inbucket/Mailpit (sin salir a Internet). Staging
   necesita un proveedor SMTP configurado en el dashboard de Supabase, con
   rate limits (`auth.rate_limit.email_sent`) revisados para el volumen de la
   beta.
3. **Completar el guion E contra staging con correo real**: recovery entregado
   por SMTP, link no reusable, link expirado y sesión ya existente. El flujo
   sin correo y la conservación del redirect ya están acreditados.
4. **Builds nativos (F4).** Una vez exista `eas.json` operable (hoy
   SCAFFOLDED, sin login de EAS en este entorno), repetir alta/login/recovery
   sobre builds preview/release, no solo sobre web.

## Comando de verificación local (repetible)

```powershell
# Sirve para confirmar que el servidor, no solo el formulario, rechaza una
# clave corta. Sustituir el email en cada corrida: signup no es idempotente.
curl.exe -s -w "`nSTATUS:%{http_code}`n" -X POST `
  "http://127.0.0.1:54421/auth/v1/signup" `
  -H "apikey: <ANON_KEY de `npx supabase status`>" `
  -H "Content-Type: application/json" `
  --data-binary "{""email"":""<nuevo>@test.local"",""password"":""short1""}"
# Esperado: 422
```
