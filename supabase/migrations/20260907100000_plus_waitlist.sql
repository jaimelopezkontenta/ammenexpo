-- Ammen — la lista de espera para cuando el techo de tres planes suba.
--
-- **Qué es, y sobre todo qué NO es.** Al llegar al límite de tres planes la app
-- no puede ofrecer un pago: no hay Stripe, no hay webhooks y no existe la tabla
-- `subscriptions`. Un botón de «Suscribirme» sería un botón que no funciona, y
-- prometer una compra que falla en silencio es peor que admitir la espera. Lo
-- que sí existe es el interés real de quien ha llegado al techo: se apunta aquí
-- con su nombre y su correo, y le avisamos cuando se puedan crear más planes.
-- **Esto no es un pago**, y el copy de la pantalla lo dice en voz alta.
--
-- Una fila por usuario (`user_id` es la clave), de dueño único: nadie lee la
-- lista de nadie, y volver a apuntarse reescribe la propia fila en vez de
-- duplicarla.

create table public.plus_waitlist (
  -- El propio usuario como clave: no puede haber dos entradas para la misma
  -- persona, y el `on delete cascade` sobre auth.users la borra si la cuenta
  -- se va (la misma referencia que usa `profiles`).
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.plus_waitlist enable row level security;

-- Decide con la columna de su propia fila, que es la regla 1: una policy de
-- SELECT que volviera a consultar su propia tabla rompería el
-- `insert ... returning`, y Postgres lo reportaría igual que un fallo de
-- WITH CHECK. La de UPDATE existe porque volver a apuntarse es un upsert, y
-- `on conflict do update` necesita poder tocar la fila propia.
create policy "tu entrada en la lista es tuya"
  on public.plus_waitlist for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "te apuntas tú"
  on public.plus_waitlist for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "reeditas tu propia entrada"
  on public.plus_waitlist for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Sin policy de DELETE: nadie se borra de la lista desde la app, y sin policy
-- RLS deniega. El único borrado real es la cascada de auth.users.

-- Los DEFAULT PRIVILEGES conceden por sí solos DELETE/TRIGGER a los roles de
-- API sobre cualquier tabla nueva (documentado en `20260819100000`); se revoca
-- TODO y se da exactamente lo que hace falta: select/insert/update para el
-- cliente (sin delete), y todo para service_role.
revoke all on public.plus_waitlist from anon, authenticated, service_role;
grant select, insert, update on public.plus_waitlist to authenticated;
grant all on public.plus_waitlist to service_role;
