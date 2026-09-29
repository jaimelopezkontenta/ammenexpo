-- Oleada 4b (EN-3, 2026-09-29): el versículo del correo, en el idioma de quien
-- lo recibe.
--
-- `email_habit_payload` pedía `verse_of_the_day_for(p_user)` sin versión, así
-- que el correo de hábito (y el win-back D3, que reutiliza el mismo payload)
-- llevaba siempre la Reina-Valera 1909: a quien tiene la app en inglés le
-- llegaba la plantilla en inglés con el versículo en español.
--
-- La versión sale del mismo sitio que el idioma de la plantilla:
-- `profile_settings.locale`, con la misma regla que `enqueue_email` usa para
-- `email_outbox.locale` (`en…` → inglés, lo demás → español). Así plantilla y
-- versículo no pueden discrepar. Dentro del idioma, la versión es la que
-- `bible_versions` marca por defecto (`web` en inglés, `rvr1909` en español),
-- como hace el cliente cuando nadie eligió otra; si faltara, la RVR1909 de
-- siempre. La referencia es la misma en los dos idiomas (lo garantiza
-- `verse_of_the_day_for`): «Juan 3:16» y «John 3:16» el mismo día.

create or replace function public.email_habit_payload(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ref text;
  v_text text;
  v_first text;
  v_gender text;
  v_locale text;
  v_version text;
  v_day integer;
  v_title text;
  v_streak_risk boolean := false;
  v_yesterday date;
begin
  select split_part(btrim(pr.display_name), ' ', 1),
         s.onboarding_answers ->> 'gender',
         s.locale
    into v_first, v_gender, v_locale
    from public.profiles pr
    join public.profile_settings s on s.id = pr.id
   where pr.id = p_user;

  select bv.code into v_version
    from public.bible_versions bv
   where bv.is_default
     and bv.language = case
       when coalesce(v_locale, 'es') like 'en%' then 'en'
       else 'es'
     end;

  select v.reference, v.text
    into v_ref, v_text
    from public.verse_of_the_day_for(p_user, coalesce(v_version, 'rvr1909')) v;

  select d.day_number, pl.title
    into v_day, v_title
    from public.profile_settings s
    join public.prayer_plans pl on pl.id = s.active_plan_id
    join public.prayer_plan_days d on d.plan_id = pl.id
   where s.id = p_user
     and pl.status = 'active'
     and d.unlock_date = public.local_today(p_user)
     and not exists (
       select 1 from public.prayer_logs l
        where l.user_id = p_user and l.plan_day_id = d.id
     )
   order by d.day_number
   limit 1;

  v_yesterday := public.local_today(p_user) - 1;
  select exists (
    select 1 from public.profiles pr
     where pr.id = p_user
       and pr.streak_last_day = v_yesterday
       and pr.streak_count > 0
  ) into v_streak_risk;

  return jsonb_strip_nulls(jsonb_build_object(
    'first_name', nullif(v_first, ''),
    'gender', v_gender,
    'verse_ref', v_ref,
    'verse_text', v_text,
    'plan_day', v_day,
    'plan_title', v_title,
    'streak_at_risk', v_streak_risk
  ));
end;
$$;

revoke execute on function public.email_habit_payload(uuid)
  from public, anon, authenticated;
grant execute on function public.email_habit_payload(uuid) to service_role;
