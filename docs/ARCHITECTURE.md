# Arquitectura de Ammen

Una vista de conjunto para quien llega nuevo. El contrato de UI vive en
`AGENTS.md`; cómo levantar todo en `README.md`; las decisiones con su porqué en
`docs/adr/`.

## Qué es

App de oración en español (y en inglés). La IA escribe un plan que se recorre
día a día; el corazón es el bucle social: cuando alguien ora por tu día, te
enteras. **Una sola base de Expo** para Android, iOS y web.

## Capas

```
app/          Rutas (Expo Router, por ficheros). Pantallas finas: piden datos a
              core/ y pintan con components/.
components/   Lo compartido. ui/ son las primitivas (Txt, Tap, Pill, Sheet,
              ConfirmDialog, GlassIconButton…); panes/ son los tres segmentos
              de «Juntos», compartidos entre la pestaña y sus rutas clásicas.
core/         Consultas, estado y lógica pura, agrupado por dominio (plans,
              bible, circles, social, notifications, email, auth…). Hooks de
              React Query; nada de JSX.
theme/        Tokens, degradados y movimiento, en claro y oscuro.
translation/  es.json y en.json con exactamente las mismas claves.
utils/        El cliente de Supabase.
supabase/     migrations/ (el esquema), functions/ (Deno), templates/ (correos
              de Auth), tests/ (aserciones SQL), seed.sql, rescue/ (histórico).
e2e/          Playwright: flujos y regresión visual con sus baselines.
scripts/      Herramientas: doctor, lock de la base, guard de migraciones,
              drenajes manuales, sincronía de secretos.
```

## Cómo viaja un dato

```
pantalla ──► hook de core/ (React Query) ──► Supabase (PostgREST)
                                                │  RPC SECURITY DEFINER / tablas con RLS
                                                ▼
                                            Postgres ──► colas (push_outbox, email_outbox)
                                                              │  pg_cron cada minuto → pg_net
                                                              ▼
                                                    edge functions (send-email,
                                                    send-intercession-push) ──► Resend / Expo
```

- **La API es la base.** Las reglas de negocio con seguridad o transacción
  viven en funciones SQL (`SECURITY DEFINER` con `set search_path = ''`); el
  cliente las llama por RPC o lee tablas protegidas por RLS. `service_role` no
  existe nunca en el cliente.
- **Las edge functions** hacen lo que no cabe en SQL: orquestar el modelo
  (`generate-prayer-plan`, con el JWT del usuario) y enviar (correo, push).
- **Un plan se escribe en el idioma de quien lo crea.** El cliente manda el de
  la interfaz (`locale`: `es` | `en`; ausente, `es`), la reserva lo guarda en
  `source_prompt.locale` y cada tramo lo lee del plan, no de la petición: un
  plan no cambia de idioma a mitad, y uno sin idioma guardado es de antes y
  sigue en español. Del idioma salen el prompt y el esquema que lee el modelo
  y la Biblia contra la que se verifican sus citas (`resolve_scripture` con
  `rvr1909` o `web`), que es también la del texto que se guarda.
- **Las colas las drena la propia base** (`run_queue_drains()`), detrás de un
  interruptor (`scheduler_settings.enabled`) apagado por defecto.
- **Los tipos de la base** se generan (`npm run db:types` → `types/supabase.ts`)
  y CI falla si derivan de las migraciones.

## Invariantes que no se rompen

1. Una migración publicada no se edita: se añade otra, con
   `npx supabase migration new`. `npm run migrations:check` lo vigila (ADR 0001).
2. Toda tabla con RLS; toda función nueva revoca `public` y concede a quien toca.
   `rls.sql` cierra a una lista lo que `anon` puede ejecutar.
3. Los drenajes de colas fallan cerrados fuera de local (ADR 0005).
4. Ningún reporte de error lleva el mensaje del error: puede citar una oración,
   que es dato de creencias (Art. 9 RGPD) (ADR 0004).
5. El contrato visual de `AGENTS.md`, con las reglas duras en ESLint.

## Entornos

| Entorno    | Qué                                                                | Dónde                                                                       |
| ---------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Local      | Docker con Supabase completo; web en Metro o export estático       | Kong `54421`, base `54422`, correo falso `54424`                            |
| Staging    | Supabase `syprzdjznuppckenuaua` + Firebase Hosting `ammen-staging` | `docs/runbooks/staging-web.md`; pausado por inactividad en el plan gratuito |
| Producción | No existe todavía                                                  | —                                                                           |

Los cambios de base en remoto entran solo con `db push`: nunca `db reset`,
nunca seeds. Los despliegues los hace una persona, no CI.

## Cómo se prueba

| Capa      | Comando              | Qué cubre                                                                                    |
| --------- | -------------------- | -------------------------------------------------------------------------------------------- |
| Unitarios | `npm run test`       | Lógica de `core/`, `scripts/` y funciones puras de `supabase/functions`                      |
| SQL       | `npm run db:test`    | Quince suites de aserciones (`scripts/dbTest.mjs`), cada una sobre una base recién reseteada |
| Flujos    | `npm run e2e`        | Playwright (Chromium) contra Metro; `e2e:static` contra el export, como CI                   |
| Visual    | `npm run e2e:visual` | Capturas en claro y oscuro contra el export estático (ADR 0003)                              |
| Todo      | `npm run verify`     | typecheck + lint + vitest + migrations:check + db:test + db:types:check                      |

CI (`.github/workflows/verify.yml`) corre lo anterior, en cada PR y en cada push
a `main`, más dos jobs sin base de datos: `functions-types` (`deno check` de las
edge functions) y `expo-health` (`expo-doctor` y `expo install --check`, no
bloqueante). La suite visual solo corre en CI cuando hay baselines `*-linux.png`
commiteadas (las genera el workflow manual `visual-baselines`); hasta entonces,
en local. Detalle en `docs/runbooks/ci.md`.
