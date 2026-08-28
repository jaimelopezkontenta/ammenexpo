-- ===========================================================================
-- Cuenta de prueba para el desarrollo local
--
-- **Solo local.** `supabase db reset` ejecuta este fichero después de las
-- migraciones (`[db.seed]` en config.toml), y `db reset` no se ejecuta jamás
-- contra producción: allí se hace `db push`, que no toca los seeds. Aun así,
-- la contraseña de abajo es pública y está escrita en el repositorio a
-- propósito — nunca debe existir un usuario con estas credenciales en ningún
-- sitio que no sea el Docker de tu portátil.
--
--     correo:      prueba@ammen.local
--     contraseña:  ammen1234
--
-- Nace de un problema concreto: cada `npm run verify` hace nueve `db reset`, y
-- cada reset se llevaba por delante la cuenta con la que se estaba mirando la
-- app. Con esto la cuenta vuelve sola después de cada uno.
--
-- Y viene con datos, que es la otra mitad: una cuenta recién creada deja las
-- cinco pestañas vacías, y una pantalla vacía no sirve para revisar un diseño.
-- Aquí hay un plan en marcha, un día de hoy, alguien que ha orado por ti y un
-- círculo con dos personas.
-- ===========================================================================

-- **El seed convive con los tests.** Las suites de `supabase/tests/` corren
-- sobre una base recién reseteada, o sea con este fichero ya dentro, así que
-- todo lo de aquí tiene que ser invisible para ellas. Dos reglas:
--
--   1. Los identificadores empiezan por `5eed0000`, para no chocar con los
--      fixtures (`11111111…`, `aaaa1111…`).
--   2. Los nombres no pueden contener nada que un test busque. La suite social
--      afirma que `search_people('Ana')` devuelve exactamente uno, así que un
--      seed con una "Ana López" la tumba. Hoy los tests buscan: Ana, María,
--      mar, maria, nunez.
--
-- Los identificadores van escritos enteros y no con variables de psql: el
-- runner de seeds de la CLI manda el fichero por lotes y no entiende los
-- meta-comandos, así que un `\set` lo rompe entero.
--
-- ---------------------------------------------------------------------------
-- Las dos cuentas. `handle_new_user()` crea el perfil y los ajustes por
-- trigger, así que aquí solo va la fila de auth.
-- ---------------------------------------------------------------------------

-- Los cuatro campos de token van a cadena vacía y no a NULL, que es lo que
-- serían por omisión. GoTrue los lee en un `string` de Go, no en un puntero, y
-- un NULL ahí revienta la consulta entera: el login devuelve "Database error
-- querying schema" y no hay nada en los logs que apunte a la fila.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  created_at, updated_at
)
values
  ('5eed0000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'prueba@ammen.local', crypt('ammen1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Jaime"}', '', '', '', '', now(), now()),
  ('5eed0000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'zoe@ammen.local', crypt('ammen1234', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Zoe Quintero"}', '', '', '', '', now(), now());

-- Sin esto no se puede iniciar sesión: GoTrue busca la identidad, no solo la
-- fila de usuario.
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
)
values
  (gen_random_uuid(), '5eed0000-0000-0000-0000-000000000001', '5eed0000-0000-0000-0000-000000000001',
   format('{"sub":"%s","email":"prueba@ammen.local","email_verified":true}', '5eed0000-0000-0000-0000-000000000001')::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), '5eed0000-0000-0000-0000-000000000002', '5eed0000-0000-0000-0000-000000000002',
   format('{"sub":"%s","email":"zoe@ammen.local","email_verified":true}', '5eed0000-0000-0000-0000-000000000002')::jsonb,
   'email', now(), now(), now());

-- ---------------------------------------------------------------------------
-- Onboarding hecho y términos aceptados: la puerta de la app los exige, y sin
-- ellos la cuenta entra directa al asistente en vez de a Hoy.
--
-- La versión tiene que coincidir con `TERMS_VERSION` de
-- `core/legal/documents.ts`. Si allí sube, aquí también, o el seed pedirá
-- aceptar los términos en cada arranque.
-- ---------------------------------------------------------------------------

-- Las claves de `topics` y `gender` son las del catálogo del cliente
-- (`core/onboarding/options.ts`: TOPIC_KEYS/GENDER_KEYS, en inglés), no las
-- etiquetas traducidas: el seed viejo guardaba «paz»/«familia»/«male» y
-- plan/nuevo enseñaba claves crudas, no marcaba chips y mandaba temas que el
-- generador descartaba en silencio.
update public.profile_settings
   set onboarding_answers = '{"seasons":["decision"],"topics":["peace","family"],
                              "gender":"masculine","custom_topic":null,
                              "reminder_keys":["morning"]}'::jsonb,
       terms_version = '2026-08-02',
       terms_accepted_at = now(),
       timezone = 'Europe/Madrid',
       locale = 'es'
 where id in ('5eed0000-0000-0000-0000-000000000001', '5eed0000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------------
-- El círculo. Va antes que el plan porque el plan es suyo: la base exige
-- que un plan con visibilidad de grupo traiga su grupo.
-- ---------------------------------------------------------------------------

insert into public.groups (id, owner_id, name, description, visibility)
values ('5eed0000-0000-0000-0000-0000000000b1', '5eed0000-0000-0000-0000-000000000001', 'Familia',
        'Los de casa, para lo de cada día.', 'private');

-- Solo Ana: a quien crea el círculo lo mete un trigger como propietario, así
-- que insertarlo aquí choca con su propia clave primaria.
insert into public.group_members (group_id, user_id, role)
values ('5eed0000-0000-0000-0000-0000000000b1', '5eed0000-0000-0000-0000-000000000002', 'member');

-- ---------------------------------------------------------------------------
-- Un plan en marcha, empezado hace tres días, para que Hoy tenga un día que
-- enseñar y la racha tenga de dónde salir.
-- ---------------------------------------------------------------------------

insert into public.prayer_plans
  (id, owner_id, title, theme, duration_days, start_date, visibility, status, group_id)
values
  ('5eed0000-0000-0000-0000-0000000000a1', '5eed0000-0000-0000-0000-000000000001',
   'Confiar más que controlar', 'confianza', 14, current_date - 3,
   'group', 'active', '5eed0000-0000-0000-0000-0000000000b1');

insert into public.prayer_plan_days
  (plan_id, day_number, title, scripture_ref, scripture_text,
   interpretation, daily_action, prayer_body, unlock_date)
values
  ('5eed0000-0000-0000-0000-0000000000a1', 1, 'Soltar el control',
   'Proverbios 3:5', 'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia.',
   'Confiar no es entender el plan completo, sino dar el siguiente paso sabiendo quién sostiene el mapa.',
   'Escribe la decisión que más te pesa y entrégasela en una frase.',
   'Padre, tomo esta decisión contigo. Cambia mi ansiedad por confianza. Amén.',
   current_date - 3),
  ('5eed0000-0000-0000-0000-0000000000a1', 2, 'La prisa y la paz',
   'Salmos 46:10', 'Estad quietos, y conoced que yo soy Dios.',
   'La prisa promete control y entrega cansancio. Estar quieto no es no hacer nada: es dejar de decidir desde el miedo.',
   'Antes de responder al primer mensaje de hoy, respira y espera un minuto.',
   'Señor, baja el ruido. Que lo urgente no me robe lo importante. Amén.',
   current_date - 2),
  ('5eed0000-0000-0000-0000-0000000000a1', 3, 'Lo que sí depende de mí',
   'Miqueas 6:8', 'Solamente hacer justicia, y amar misericordia, y humillarte ante tu Dios.',
   'No controlas el resultado, pero sí el trato. Hoy la fidelidad se mide en cómo hablas a quien tienes cerca.',
   'Di en voz alta una cosa que agradeces de alguien con quien vives o trabajas.',
   'Dios, hazme fiel en lo pequeño mientras espero lo grande. Amén.',
   current_date - 1),
  ('5eed0000-0000-0000-0000-0000000000a1', 4, 'Confiar cuando no veo el camino',
   'Proverbios 3:6', 'Reconócelo en todos tus caminos, y él enderezará tus veredas.',
   'El camino se endereza andando, no mirándolo desde fuera. Hoy no necesitas todas las respuestas.',
   'Da el paso más pequeño que puedas dar hoy en la decisión que tienes parada.',
   'Padre, doy un paso sin ver el final. Ve tú delante. Amén.',
   current_date);

-- Los diez días que faltan van escritos y cerrados a futuro. Sin ellos
-- `plan_progress.days_written` queda en 4 de 14, el detector de generación
-- atascada se dispara (el heartbeat del seed es viejo) y Hoy enseña
-- «se quedó a medias» en la cuenta de prueba, que es un plan sano del día 4.
insert into public.prayer_plan_days
  (plan_id, day_number, title, scripture_ref, scripture_text,
   interpretation, daily_action, prayer_body, unlock_date)
select
  '5eed0000-0000-0000-0000-0000000000a1',
  n,
  'Confiar el día ' || n,
  'Proverbios 3:5',
  'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia.',
  'La confianza también es esperar el día que todavía no ha llegado.',
  'Descansa en lo que ya oraste. Mañana habrá otro paso.',
  'Padre, me fío de Ti también en lo que todavía no veo. Amén.',
  current_date + (n - 4)
from generate_series(5, 14) as n;

-- Alguien ha orado por el día de hoy: es la mitad del producto y la razón de
-- volver mañana, así que tiene que verse en Hoy desde el primer arranque.
insert into public.intercessions (plan_day_id, plan_owner_id, intercessor_id, message)
select d.id, '5eed0000-0000-0000-0000-000000000001', '5eed0000-0000-0000-0000-000000000002', 'Pedí paz para tu decisión. Un abrazo.'
  from public.prayer_plan_days d
 where d.plan_id = '5eed0000-0000-0000-0000-0000000000a1'
   and d.day_number = 4;

insert into public.plan_shares (plan_id, group_id, created_by)
values ('5eed0000-0000-0000-0000-0000000000a1',
        '5eed0000-0000-0000-0000-0000000000b1', '5eed0000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Flags: la comunidad se abre en local.
--
-- `community_feed` nace OFF en la migración
-- (`20260826100000_feature_flags.sql`), que es el default de una instalación
-- limpia/remota. El seed lo enciende a propósito: las suites de `db:test` y la
-- revisión manual de la app parten del contrato B2 vigente — el feed sirve lo
-- público reciente —, y probar que "OFF bloquea el feed" es trabajo de
-- `supabase/tests/flags.sql`, que lo apaga y lo enciende él mismo. En remoto
-- no pasa nada de esto: `db push` no ejecuta seeds, así que allá sigue OFF
-- hasta que el canal administrativo lo abra.
-- ---------------------------------------------------------------------------

update public.feature_flags
   set enabled = true,
       updated_at = now()
 where key = 'community_feed';
