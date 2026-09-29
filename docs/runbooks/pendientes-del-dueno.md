# Pendientes del dueño

Lo que **solo puede hacer o decidir Jaime** después de la auditoría de septiembre de 2026
(`docs/auditoria-2026-09.md`). El código de todo lo demás está en `main`; esto es lo
que queda fuera de él: cuentas, secretos, despliegues, decisiones legales y de
producto, y lo que hay que mirar con un dispositivo delante.

Convención del proyecto: los despliegues, `db push`, secretos y el encendido del
programador de colas los hace una persona, nunca CI ni un agente
(`AGENTS.md`). Contra staging solo `db push`: jamás `db reset` ni seeds.

## 1. Staging (lo más urgente: hay un arreglo de seguridad esperando)

La fuga del chat de círculos (quien sale de un círculo seguía leyendo y escribiendo)
está corregida en el repo pero **sigue abierta en staging hasta el `db push`**.
Staging (`ammen-staging`, Supabase `syprzdjznuppckenuaua`) estaba pausado.

Orden exacto en `docs/runbooks/staging-web.md` (secciones «Migraciones rescatadas»,
«Programador de colas» y «Rollback»). Resumen:

1. Restaurar el proyecto en el panel de Supabase.
2. `pg_dump` de staging (copia de seguridad antes de tocar nada).
3. `npx supabase migration list --linked` y comparar con `supabase/migrations/`
   (el caso de la versión `20260908100000` está explicado en el runbook).
4. `npx supabase db push` (**base primero, web después**). Trae, entre otras: las 8
   migraciones rescatadas, topes de invitación, avatares, índices de FK, privilegios de
   funciones, programador de colas (apagado por defecto), retención, borrado de cuenta
   completo, cuota de planes, **Biblia por versión con la World English Bible (4,3 MB en
   una sola sentencia)** y las correcciones de SQL de la revisión de seguridad.
5. Correr en staging las consultas de comprobación de permisos del runbook (que `anon` no
   ejecute funciones que no debe).
6. Configurar la URL base de avatares del proyecto (ajuste que documenta el runbook).
7. Desplegar las Edge Functions (`send-email`, `enqueue-emails`, `email-unsubscribe`,
   `resend-webhook`, `send-intercession-push`, `generate-prayer-plan`) con sus secretos
   en Secret Manager **y** en Vault (`AMMEN_EMAIL_INVOKE_SECRET`,
   `AMMEN_PUSH_INVOKE_SECRET` son **obligatorios**: sin ellos las funciones se cierran).
8. Antes de encender el programador: `skip_stale_queue_rows(...)` para no enviar de golpe lo
   acumulado desde agosto; después `scheduler_settings.enabled = true` (enciende también
   `run_email_jobs` y la retención).
9. Smoke remoto (sección «Smoke remoto» del runbook) y, solo entonces, desplegar la web.

`generate-prayer-plan` cambió sus códigos de respuesta (400 con motivo, 500
`persist_failed`/`claim_failed`, 503 `auth_unavailable`/`not_configured`); la app ya los
entiende, pero conviene mirar una generación real tras el despliegue. Además, los
tiempos (`providers/retry.ts`: 270 s por tramo, dos intentos por modelo) están pensados
para el límite de pared de las funciones; si el plan gratuito de Supabase corta antes,
ajustarlos allí.

## 2. Decisiones (cada una condiciona algo concreto)

| # | Decisión | Condiciona | Recomendación |
|---|---|---|---|
| J2 | Alta: **captcha (Turnstile)** ya; confirmación de correo después (código de 6 dígitos + SMTP propio) | Abuso de invitaciones y coste de LLM por cuenta. Hoy `[auth.captcha]` está apagado y la confirmación también | Captcha y topes primero |
| J3 | Tope de gasto del workspace de Anthropic y alerta diaria (`generation_ledger`) | Coste | Tú fijas el presupuesto |
| J4 | Legal antes de correo en producción: consentimiento y encargados (Anthropic, Resend) para datos de creencias (Art. 9 RGPD), región de producción, opt-in por defecto del correo no transaccional (LSSI) | Encender el correo; elegir región | Revisión legal breve |
| J5 | Plazos de retención (90/180/30/7 días de `purge_expired_rows()`) | Retención | Aceptarlos o cambiarlos con una migración |
| J6 | Biblia inglesa: **World English Bible** (dominio público). Supuesto salvo que digas KJV | Contenido en inglés | Confirmar |
| J6b | Los términos ahora nombran las dos Biblias (RVR1909 y WEB): ¿subir `TERMS_VERSION` (obliga a reaceptar) o no? | Términos | No subirla si el cambio es solo informativo |
| J7 | Recursos de crisis por país (`core/crisis/resources.ts`): quién valida los números y el texto | Pantalla de crisis | Un especialista; cada entrada dice «pendiente de revisión» |
| J8 | Jerarquía de H1 (una sesión mirando capturas) | Sistema visual | — |
| J10 | Proteger `main` exigiendo CI | Hoy el único guardián es CI tras el push | Baja prioridad |
| J11 | Modelo del generador: hoy `claude-sonnet-5`; existe `claude-sonnet-5-5` | Calidad/coste | Evaluarlo con un conjunto de planes antes de cambiar |
| J12 | Correo de hábito: sale siempre en español (falta el idioma en el perfil) | Usuarios en inglés | Guardar idioma en `profile_settings` |

## 3. Cuentas y dispositivos (lote nativo)

El lote nativo (sesión en llavero, NetInfo, copiar enlace, exportar fichero, crisis por
país, push) está escrito y probado con tests unitarios, pero **no se ha ejecutado en
ningún dispositivo** y exige un **binario nuevo** (no llega por OTA). Todo está en
`docs/runbooks/native-release.md`; lo mínimo que solo tú puedes poner:

- Cuentas Apple Developer y Google Play, `EAS_PROJECT_ID` y variables `EXPO_PUBLIC_*` en
  cada entorno de EAS.
- Dominio y DNS para universal links, `EXPO_PUBLIC_UNIVERSAL_LINK_HOST`, y rellenar las
  plantillas de `docs/runbooks/universal-links/` con el Team ID y el SHA-256 reales.
  `firebase.json` hoy ignora `**/.*`: `.well-known` no se serviría sin cambiarlo.
- Decidir `expo-updates` (hoy **no** está instalado y `eas.json` ya no declara canales).
- Probar en dispositivo real la lista de la sección 3 del runbook (login/logout/reinicio,
  migración de una sesión antigua, modo avión, exportar >1 MB, tap de push, universal
  links).
- Decisión de producto: en iOS el llavero sobrevive a la desinstalación; reinstalar puede
  devolver la sesión anterior.
- `npx expo install --fix` (10 paquetes de SDK 56 con parches por detrás) y el aviso de
  Hermes V1 de `expo-doctor` (lo arregla expo ≥ 57.0.9 o React Native ≥ 0.86.2): decisión
  de dependencias, no de CI. El job `expo-health` es informativo mientras tanto.

## 4. CI y baselines visuales

- La regresión visual ya es bloqueante en CI: hay 58 baselines `*-linux.png`
  commiteadas (generadas por el workflow `visual-baselines`). Tras un cambio visual
  deliberado, regenerar los dos juegos (`docs/runbooks/ci.md`, `docs/adr/0003-…`).
- El primer run de los workflows nuevos (`functions-types`, `expo-health`,
  `visual-baselines`, Dependabot) es la prueba real; ninguno se había ejecutado.

## 4b. Producto: lo que quedó sin pantalla

- **Rotar el enlace de invitación** (RPC `rotate_circle_invite_token` y
  `rotate_my_invite_code`, con tests): sin botón en la app. Además el cliente debe
  invalidar `qk.inviteCode`, que hoy no caduca nunca.
- **Selector de versión de la Biblia** solo en el lector; la pestaña Biblia muestra la
  versión pero no deja cambiarla.
- **El plan de un círculo** sale en el idioma de quien lo crea, no en el de cada miembro.
- **Los planes ya existentes** conservan su texto y versículos (RVR, español); un plan
  nuevo pedido con la app en inglés sale en inglés.
- **A−/A+ del lector**: la letra pequeña ahora sí se ve más pequeña (antes no hacía
  nada); comprobarlo con los ojos.
- **Tamaños de letra que nunca se aplicaron** (siete rótulos en cursiva querían 16 px y se
  ven a 18; el texto de `lista/orar` quería 24 px y se ve a 18; las etiquetas del raíl de
  escritorio querían 11,5 px y se ven a 14): decidir si se quieren de verdad.
- **Errata en el prompt español del generador** («Diríjete» por «Dirígete»): no se
  corrigió a propósito (el prompt español está fijado byte a byte por un test); si se
  arregla, actualizar la huella en el mismo commit.
- **`circulo/[id]` mientras carga no tiene cabecera** (ni título ni volver).

## 5. Cosas que el código ya no puede resolver solo

- **Fotos de perfil al borrar la cuenta**: SQL no puede borrar objetos de Storage (trigger
  `protect_delete`); el cliente las borra antes y, si falla, quedan hasta un futuro job.
- **Backups de staging**: el plan gratuito no tiene copias automáticas.
- **Producción**: no existe entorno de producción; elegir región según el Art. 9 (J4).
