-- Complete the personal-data download with collections added after its first
-- release. Preserve all existing sections and the authenticated-only RPC.

create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'about_this_file',
      'Este fichero contiene tus datos de Ammen. Guárdalo con cuidado: '
      || 'incluye lo que escribiste, incluidas las peticiones que publicaste '
      || 'de forma anónima.',

    'profile', (
      select to_jsonb(x) from (
        select p.display_name, p.avatar_url, p.streak_count, p.streak_last_day,
               p.created_at
        from public.profiles p where p.id = (select auth.uid())
      ) x
    ),

    'settings', (
      select to_jsonb(x) from (
        select s.timezone, s.locale, s.reminder_hours, s.onboarding_answers,
               s.terms_version, s.terms_accepted_at
        from public.profile_settings s where s.id = (select auth.uid())
      ) x
    ),

    -- Los planes con sus días dentro. Un export donde los días fueran una lista
    -- suelta con un `plan_id` obligaría a reconstruirlo a mano para leerlo.
    'plans', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pl.title, pl.theme, pl.duration_days, pl.start_date,
               pl.visibility, pl.status, pl.created_at,
               (
                 select coalesce(jsonb_agg(to_jsonb(d) order by d.day_number), '[]'::jsonb)
                 from (
                   select day_number, title, scripture_ref, scripture_text,
                          interpretation, daily_action, prayer_body, unlock_date
                   from public.prayer_plan_days
                   where plan_id = pl.id
                 ) d
               ) as days
        from public.prayer_plans pl
        where pl.owner_id = (select auth.uid())
      ) x
    ),

    'days_i_prayed', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select d.day_number, pl.title as plan_title, l.note, l.completed_at
        from public.prayer_logs l
        join public.prayer_plan_days d on d.id = l.plan_day_id
        join public.prayer_plans pl on pl.id = d.plan_id
        where l.user_id = (select auth.uid())
        order by l.completed_at
      ) x
    ),

    'prayer_requests', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        -- El anonimato se marca en vez de esconderse: es tuyo y tienes derecho
        -- a llevártelo, pero tienes que saber que va dentro antes de mandarle
        -- el fichero a alguien.
        select po.body, po.is_anonymous, po.prayer_count, po.answered_at,
               po.held_at, po.created_at
        from public.posts po
        where po.author_id = (select auth.uid())
        order by po.created_at
      ) x
    ),

    'comments', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select c.body, c.held_at, c.created_at
        from public.comments c
        where c.author_id = (select auth.uid())
        order by c.created_at
      ) x
    ),

    'testimonies', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select t.body, t.visibility, t.created_at
        from public.testimonies t
        where t.user_id = (select auth.uid())
        order by t.created_at
      ) x
    ),

    -- Quién oró por ti lleva el nombre de esa persona, que es exactamente lo
    -- que la app te enseña: sin el nombre, «alguien oró por ti 40 veces» no es
    -- tu historia, es una estadística.
    'prayers_received', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pr.display_name as from_person, i.message, i.created_at
        from public.intercessions i
        join public.profiles pr on pr.id = i.intercessor_id
        where i.plan_owner_id = (select auth.uid())
        order by i.created_at
      ) x
    ),

    'prayers_given', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pr.display_name as for_person, i.message, i.created_at
        from public.intercessions i
        join public.profiles pr on pr.id = i.plan_owner_id
        where i.intercessor_id = (select auth.uid())
        order by i.created_at
      ) x
    ),

    'circles', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select g.name, m.role, m.joined_at
        from public.group_members m
        join public.groups g on g.id = m.group_id
        where m.user_id = (select auth.uid())
      ) x
    ),

    'following', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pr.display_name, f.created_at
        from public.follows f
        join public.profiles pr on pr.id = f.followee_id
        where f.follower_id = (select auth.uid())
      ) x
    ),

    -- Collections introduced after the original export. Explicit owner filters
    -- are required because this function runs as SECURITY DEFINER.
    'prayer_list', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at, x.id), '[]'::jsonb)
      from (
        select li.id, li.body, li.tag, li.answered_at, li.created_at, li.updated_at
        from public.prayer_list_items li where li.user_id = (select auth.uid())
      ) x
    ),
    'bible_notes', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.book_id, x.chapter, x.verse), '[]'::jsonb)
      from (
        select n.book_id, n.chapter, n.verse, n.body, n.created_at, n.updated_at
        from public.bible_notes n where n.user_id = (select auth.uid())
      ) x
    ),
    'bible_highlights', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.book_id, x.chapter, x.verse), '[]'::jsonb)
      from (
        select h.book_id, h.chapter, h.verse, h.created_at
        from public.bible_highlights h where h.user_id = (select auth.uid())
      ) x
    ),
    'plus_waitlist', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select w.name, w.email, w.created_at
        from public.plus_waitlist w where w.user_id = (select auth.uid())
      ) x
    ),

    'blocked', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
        select pr.display_name, b.created_at
        from public.blocks b
        join public.profiles pr on pr.id = b.blocked_id
        where b.blocker_id = (select auth.uid())
      ) x
    )
  );
$$;

revoke execute on function public.export_my_data() from public, anon;

grant execute on function public.export_my_data() to authenticated;

