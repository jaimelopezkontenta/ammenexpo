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
| J2 | Alta: **captcha (Turnstile)** ya; confirmación de correo después (código de 6 dígitos + SMTP propio) | Abuso de invitaciones y coste de LLM por cuenta. Hoy `[auth.captcha]` está apagado y la confirmación también | Captcha y topes primero. **Estado 2026-10-05:** `config.toml` trae el bloque listo (provider `turnstile`, secreto por `env(TURNSTILE_SECRET_KEY)`); encenderlo exige en la misma ola el widget + `captcha_token` en `signUp`/`signIn` y sus e2e — sin cliente, bloquea altas y logins. Faltan tus claves de Cloudflare (sitekey + secret) para hacerlo |
| J3 | Tope de gasto del workspace de Anthropic y alerta diaria (`generation_ledger`) | Coste | Tú fijas el presupuesto |
| J4 | Legal antes de correo en producción: consentimiento y encargados (Anthropic, Resend) para datos de creencias (Art. 9 RGPD), región de producción, opt-in por defecto del correo no transaccional (LSSI) | Encender el correo; elegir región | Revisión legal breve |
| J5 | Plazos de retención (90/180/30/7 días de `purge_expired_rows()`) | Retención | Aceptarlos o cambiarlos con una migración |
| J6 | Biblia inglesa: **World English Bible** (dominio público). Supuesto salvo que digas KJV | Contenido en inglés | Confirmar. **Confirmada el 2026-10-05** |
| J6b | Los términos ahora nombran las dos Biblias (RVR1909 y WEB): ¿subir `TERMS_VERSION` (obliga a reaceptar) o no? | Términos | No subirla si el cambio es solo informativo. **Decidido el 2026-10-05: no se sube** (cambio solo informativo; `TERMS_VERSION` sigue en `2026-08-02`). Si lo quieres al revés, dilo y se sube con migración |
| J7 | Recursos de crisis por país (`core/crisis/resources.ts`): quién valida los números y el texto | Pantalla de crisis | Un especialista; cada entrada dice «pendiente de revisión» |
| J8 | Jerarquía de H1 (una sesión mirando capturas) | Sistema visual | — |
| J10 | Proteger `main` exigiendo CI | Hoy el único guardián es CI tras el push | Baja prioridad |
| J11 | Modelo del generador: hoy `claude-sonnet-5`; existe `claude-sonnet-5-5` | Calidad/coste | Evaluarlo con un conjunto de planes antes de cambiar |
| J12 | Correo de hábito: sale siempre en español (falta el idioma en el perfil) | Usuarios en inglés | Guardar idioma en `profile_settings`. **Hecho en código el 2026-10-05** (ya estaba: `LanguageSwitcher` persiste con `useUpdateLocale` y el hábito usa `profile_settings.locale` — cubierto por `email.sql`: verso WEB en inglés, RVR en español) |

## 3. Cuentas y dispositivos (lote nativo)

El lote nativo (sesión en llavero, NetInfo, copiar enlace, exportar fichero, crisis por
país, push) está escrito y probado con tests unitarios, pero **no se ha ejecutado en
ningún dispositivo** y exige un **binario nuevo** (no llega por OTA). Todo está en
`docs/runbooks/native-release.md`; lo mínimo que solo tú puedes poner:

- Cuentas Apple Developer y Google Play, `EAS_PROJECT_ID` y variables `EXPO_PUBLIC_*` en
  cada entorno de EAS.
- Dominio y DNS para universal links, `EXPO_PUBLIC_UNIVERSAL_LINK_HOST`, y rellenar las
  plantillas de `docs/runbooks/universal-links/` con el Team ID y el SHA-256 reales.
  `firebase.json` **ya** sirve `public/.well-known/` (verificado 2026-10-05: el
  glob de `firebase-tools` con `**/.*` no recorta subdirectorios de dotfiles y
  `expo export` los copia vía `fs.cp`); la cabecera `Content-Type:
  application/json` para `/.well-known/**` ya está en el fichero.
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

## 4a. Seguridad de datos: lo que sigue abierto tras el barrido de privilegios

La migración `circle_column_privileges` y sus tres hermanas (`invite_…`, `share_link_…`,
`post_column_privileges`) cierran las escaladas más graves (un admin que no era dueño podía
ponerse `owner_id` y echar a la dueña; cualquiera entraba en un círculo público como admin; un
enlace de plan ajeno se podía crear y canjear; una invitación se podía fabricar ya «aceptada»).
La segunda ronda (`20260930000648_profile_settings_column_privileges` … `20260930000720_client_insert_column_privileges`)
cerró el resto: ajustes del perfil (términos y onboarding solo por RPC; `accept_terms` pasa a
SECURITY DEFINER), comentarios y mensajes sin marcas de moderación ni fecha elegida,
testimonios colgados solo de lo tuyo y sin `image_url`, el chat por dentro solo por RPC, la lista
de espera de Plus siempre al correo de la cuenta, denuncias y avisos por columnas, y todas las
tablas donde el cliente solo inserta (el día de un círculo ya no se escribe a mano: subía la
racha). Ninguna tabla de `public` concede ya INSERT ni UPDATE de tabla entera, y `rls.sql` falla
si vuelve a aparecer uno. Lo que queda, por prioridad:

1. **Decisión de producto:** un admin puede añadir a cualquier persona a su círculo sin su
   consentimiento, y un admin que no es dueño puede pasar un círculo de privado a público (quien
   entre lee el historial).
2. `app/plus.tsx` deja teclear un correo que el servidor ya ignora (guarda el de la cuenta): el
   campo debería ser de solo lectura. **Hecho el 2026-10-05** (campo no editable + aviso «usamos
   el correo de tu cuenta», con su clave es+en).
3. `complete_onboarding` guarda `p_answers` sin validar la forma ni el tamaño; acaba en el prompt
   (que lo filtra) y en los correos (`gender`). **Hecho el 2026-10-05**: `validate_onboarding_answers`
   (`20261005071900`, forma y tamaño — no catálogo, que ya filtran lectura y prompt) con 12
   assertions en `flows.sql`.
4. Los privilegios por defecto de `public` dan TRUNCATE, REFERENCES, TRIGGER y MAINTAIN a `anon` y
   `authenticated` en cada tabla nueva. PostgREST no los expone, pero sobran. **A medias el
   2026-10-05**: ninguna tabla los concede hoy (verificado) y el catálogo de `rls.sql` ya los
   prohíbe junto a INSERT/UPDATE; pero la REGLA por defecto sigue dándolos y solo un superusuario
   la recorta (las migraciones corren como `postgres` y no pueden). **Paso manual pendiente por
   entorno** (local hecho; falta staging y, cuando exista, producción): como superusuario,
   reescribir la regla `supabase_admin|public|r` a `postgres,service_role=ALL + anon,authenticated=arwd`.

**Tras el `db push` a staging**, además de lo del runbook: comprobar los permisos con
`information_schema.column_privileges` (`grantee = 'authenticated'`) y buscar rastro de abusos
anteriores: `groups` cuyo `owner_id` no coincide con la fila `role = 'owner'` de
`group_members`; filas `role = 'admin'` (la app no tiene forma de nombrarlos: todas son
sospechosas); `member_count`/`prayer_count`/`comment_count` distintos del recuento real; tokens que
no cumplan `~ '^[0-9a-f]{32}$'` (`invite_token`, `invites.code`, `share_links.token`); `share_links`
con `scope = 'plan'` cuyo `created_by` no es el dueño del plan, y los `scope = 'group'` sin revocar
(siguen canjeándose: revisarlos y revocarlos).

De la segunda ronda: la consulta de catálogo del final de `rls.sql` debe salir vacía también en
staging, y conviene mirar `pg_default_acl` de `public` (un proyecto antiguo puede seguir dando
`arwd` a `anon`/`authenticated` en cada tabla nueva). Rastro de abusos: `crisis_escalations` y
`content_holds` cuyo texto no dispara `is_crisis_text`/`is_objectionable`; comentarios, mensajes,
intercesiones, denuncias o avisos con `created_at` en el futuro; filas de `conversation_members`
de alguien que no es del círculo o con `last_read_at` en el futuro; `conversations` sin
`group_id`; testimonios con `image_url` o con un `plan_id`/`list_item_id` que no es del autor;
`profile_settings` con `terms_accepted_at` anterior al 2026-08-13 o una `terms_version` que no sea
`AAAA-MM-DD`; `groups.streak_count` mayor que los días de su plan; y `email_outbox` con
`template = 'waitlist'` a una dirección que no es la de la cuenta (ya enviados: no se deshacen; la
migración alinea las filas de `plus_waitlist`).

## 4b. Producto: lo que quedó sin pantalla

- **Rotar el enlace de invitación** (RPC `rotate_circle_invite_token` y
  `rotate_my_invite_code`, con tests): sin botón en la app. Además el cliente debe
  invalidar `qk.inviteCode`, que hoy no caduca nunca.
  **Corregido el 2026-10-05: el doc estaba desactualizado** — los botones existen
  (`app/invitar.tsx`, `app/circulo/[id]`) y los hooks actualizan la caché
  (`core/social/invites.ts`, `core/circles/queries.ts`).
- **Selector de versión de la Biblia** solo en el lector; la pestaña Biblia muestra la
  versión pero no deja cambiarla. **Hecho el 2026-10-05**: `components/BibleVersionPicker.tsx`
  compartido entre lector y pestaña.
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
  arregla, actualizar la huella en el mismo commit. **Arreglado el 2026-10-05**
  (femenino y masculino) **con sus dos huellas actualizadas** en `prompt.test.ts`.
- **`circulo/[id]` mientras carga no tiene cabecera** (ni título ni volver).
  **Hecho el 2026-10-05**: `ScreenScaffold` con `loading` + `skeleton="circle"`.

## 5. Cosas que el código ya no puede resolver solo

- **Fotos de perfil al borrar la cuenta**: SQL no puede borrar objetos de Storage (trigger
  `protect_delete`); el cliente las borra antes y, si falla, quedan hasta un futuro job.
- **Backups de staging**: el plan gratuito no tiene copias automáticas.
- **Producción**: no existe entorno de producción; elegir región según el Art. 9 (J4).
