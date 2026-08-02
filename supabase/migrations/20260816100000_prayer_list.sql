-- Ammen — tu lista de oración.
--
-- El hueco más grande que tenía la app: **solo existía el plan que escribe la
-- IA**. Y lo que la gente hace de verdad cada día no es un plan de treinta días
-- sobre un tema, es una lista de nombres — «mi madre, el trabajo de Luis, la
-- decisión de mudarnos». Echo y PrayerMate están construidas enteras sobre esto
-- y aquí no cabía en ninguna parte.
--
-- De dueño único, como `profile_settings`: no se comparte, no se ve, no se
-- reporta. Es la parte más privada del producto y por eso no tiene ni una sola
-- policy que mencione a otra persona.

create table public.prayer_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  -- Una etiqueta suelta —«familia», «trabajo»— y no una tabla de categorías:
  -- quien tiene ocho peticiones no necesita administrar taxonomías.
  tag text check (char_length(tag) <= 40),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prayer_list_items_user_idx
  on public.prayer_list_items (user_id, answered_at nulls first, created_at desc);

create trigger prayer_list_items_set_updated_at
  before update on public.prayer_list_items
  for each row execute function public.set_updated_at();

alter table public.prayer_list_items enable row level security;

-- Decide con la columna de su propia fila, que es la regla 1: una policy de
-- SELECT que volviera a consultar su propia tabla rompería el
-- `insert ... returning`, y Postgres lo reportaría igual que un fallo de
-- WITH CHECK. Cada tabla nueva se gana su assertion de regresión.
create policy "your list is yours"
  on public.prayer_list_items for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "you write your own list"
  on public.prayer_list_items for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "you edit your own list"
  on public.prayer_list_items for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "you delete from your own list"
  on public.prayer_list_items for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Los GRANT son una capa distinta de RLS: sin esto el error sería "permission
-- denied for table prayer_list_items", que no se parece en nada a un fallo de
-- policy.
grant select, insert, update, delete on public.prayer_list_items to authenticated;
grant all on public.prayer_list_items to service_role;

-- ---------------------------------------------------------------------------
-- Cuando algo se responde
-- ---------------------------------------------------------------------------
--
-- `testimonies.plan_id` existe desde la Fase 1 y esta columna es su hermana
-- natural: el cuarto bucle del producto —terminas algo y cuentas que pasó— vale
-- igual para una petición de la lista que para un plan de treinta días. Sin
-- esto, marcar respondida sería un tachón y nada más.

alter table public.testimonies
  add column list_item_id uuid references public.prayer_list_items (id) on delete set null;
