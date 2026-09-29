--
-- PostgreSQL database dump
--

\restrict GKVDpszuAbnhQnUFCENacqBijPCW9UOAcmKDqA9JFO4Wf1r3FKrtPgYrykyawlp

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA _realtime;


--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_functions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_functions;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: group_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.group_role AS ENUM (
    'owner',
    'admin',
    'member'
);


--
-- Name: group_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.group_visibility AS ENUM (
    'private',
    'public'
);


--
-- Name: plan_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_source AS ENUM (
    'ai',
    'manual'
);


--
-- Name: plan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_status AS ENUM (
    'generating',
    'failed',
    'active',
    'completed',
    'archived'
);


--
-- Name: plan_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_visibility AS ENUM (
    'private',
    'group',
    'link',
    'public'
);


--
-- Name: report_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.report_status AS ENUM (
    'open',
    'reviewed',
    'dismissed'
);


--
-- Name: share_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.share_scope AS ENUM (
    'plan',
    'group'
);


--
-- Name: testimony_visibility; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.testimony_visibility AS ENUM (
    'private',
    'circles',
    'public'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in',
    'like',
    'ilike',
    'is',
    'match',
    'imatch',
    'isdistinct'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text,
	negate boolean
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
begin
    if not exists (
        select 1
        from pg_event_trigger_ddl_commands() ev
        join pg_catalog.pg_extension e on ev.objid = e.oid
        where e.extname = 'pg_graphql'
    ) then
        return;
    end if;

    drop function if exists graphql_public.graphql;
    create or replace function graphql_public.graphql(
        "operationName" text default null,
        query text default null,
        variables jsonb default null,
        extensions jsonb default null
    )
        returns jsonb
        language sql
    as $$
        select graphql.resolve(
            query := query,
            variables := coalesce(variables, '{}'),
            "operationName" := "operationName",
            extensions := extensions
        );
    $$;

    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,
    -- which in turn triggers set_graphql_placeholder to reinstall the "not enabled" stub.
    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);

    grant usage on schema graphql to postgres, anon, authenticated, service_role;
    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;
    grant usage on schema graphql to postgres with grant option;
    grant usage on schema graphql_public to postgres with grant option;
end;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
    ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

    ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
    ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

    REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

    GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: -
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
begin
    raise debug 'PgBouncer auth request: %', p_usename;

    return query
    select 
        rolname::text, 
        case when rolvaliduntil < now() 
            then null 
            else rolpassword::text 
        end 
    from pg_authid 
    where rolname=$1 and rolcanlogin;
end;
$_$;


--
-- Name: accept_terms(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_terms(p_version text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if p_version is null or btrim(p_version) = '' then
    raise exception 'a version is required';
  end if;

  update public.profile_settings
     set terms_version = p_version,
         terms_accepted_at = now()
   where id = (select auth.uid());

  -- Cero filas es como RLS rechaza un update: sin error y sin filas. Aquí eso
  -- significaría que alguien se queda dando al botón sin que pase nada.
  if not found then
    raise exception 'profile settings missing';
  end if;
end;
$$;


--
-- Name: acknowledge_crisis(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acknowledge_crisis(p_id uuid, p_note text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_staff() then
    return false;
  end if;

  if p_note is null or char_length(btrim(p_note)) = 0 then
    raise exception 'acknowledge_crisis requires a note';
  end if;

  update public.crisis_escalations
     set acknowledged_by = (select auth.uid()),
         acknowledged_at = now(),
         note = btrim(p_note)
   where id = p_id
     and acknowledged_at is null;

  return found;
end;
$$;


--
-- Name: admin_set_flag(text, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_flag(p_key text, p_enabled boolean, p_actor text, p_reason text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_actor is null or char_length(btrim(p_actor)) = 0 then
    raise exception 'admin_set_flag requires who is operating';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'admin_set_flag requires a reason';
  end if;

  update public.feature_flags
     set enabled = p_enabled,
         updated_at = now()
   where key = p_key;

  if not found then
    raise exception 'unknown flag: %', p_key;
  end if;

  insert into public.feature_flag_events (flag_key, action, actor, reason)
  values (
    p_key,
    case when p_enabled then 'enable' else 'disable' end,
    btrim(p_actor),
    btrim(p_reason)
  );

  return true;
end;
$$;


--
-- Name: admin_set_staff(uuid, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_staff(p_user_id uuid, p_make_staff boolean, p_actor text, p_reason text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_actor is null or char_length(btrim(p_actor)) = 0 then
    raise exception 'admin_set_staff requires who is operating';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'admin_set_staff requires a reason';
  end if;

  update public.profiles
     set is_staff = p_make_staff
   where id = p_user_id;

  if not found then
    return false;
  end if;

  insert into public.staff_admin_events (target_user_id, action, actor, reason)
  values (
    p_user_id,
    case when p_make_staff then 'grant' else 'revoke' end,
    btrim(p_actor),
    btrim(p_reason)
  );

  return true;
end;
$$;


--
-- Name: archive_my_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_my_plan(p_plan_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  current_user_id uuid := (select auth.uid());
  updated integer;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  update public.prayer_plans
     set status = 'archived'
   where id = p_plan_id
     and owner_id = current_user_id
     and status in ('active', 'completed');

  get diagnostics updated = row_count;

  if updated = 0 then
    raise exception 'not_archivable';
  end if;

  -- El puntero de Hoy no debe seguir apuntando a un plan que ya no se lista.
  update public.profile_settings
     set active_plan_id = null
   where id = current_user_id
     and active_plan_id = p_plan_id;
end;
$$;


--
-- Name: blocked_either_way(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.blocked_either_way(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_user_id)
       or (b.blocker_id = p_user_id and b.blocked_id = (select auth.uid()))
  );
$$;


--
-- Name: bump_group_streak(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_group_streak() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_day date;
  v_threshold integer;
  v_prayed integer;
  v_last date;
  v_streak integer;
begin
  select d.unlock_date into v_day
  from public.prayer_plan_days d
  where d.id = new.plan_day_id;

  select ceil(g.member_count / 2.0)::integer, g.streak_last_day, g.streak_count
    into v_threshold, v_last, v_streak
  from public.groups g
  where g.id = new.group_id;

  -- Rellenar un día antiguo no debe volver a contarlo ni retroceder la racha.
  if v_last is not null and v_day <= v_last then
    return new;
  end if;

  select count(*)::integer into v_prayed
  from public.group_prayer_days gp
  where gp.plan_day_id = new.plan_day_id;

  if v_prayed < greatest(v_threshold, 1) then
    return new;
  end if;

  if v_last is not null and v_last >= v_day - 2 then
    v_streak := coalesce(v_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  update public.groups
     set streak_count = v_streak,
         streak_last_day = v_day
   where id = new.group_id;

  return new;
end;
$$;


--
-- Name: bump_personal_streak(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_personal_streak() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  today date := public.local_today(new.user_id);
  last_day date;
  current_streak integer;
begin
  select p.streak_last_day, p.streak_count
    into last_day, current_streak
  from public.profiles p
  where p.id = new.user_id;

  if last_day = today then
    return new;
  elsif last_day >= today - 2 then
    -- Yesterday, or the day before: the grace day.
    current_streak := coalesce(current_streak, 0) + 1;
  else
    current_streak := 1;
  end if;

  update public.profiles
     set streak_count = current_streak,
         streak_last_day = today
   where id = new.user_id;

  return new;
end;
$$;


--
-- Name: can_create_circle_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_create_circle_plan(p_group_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.is_group_admin(p_group_id)
    and not exists (
      select 1 from public.prayer_plans p
      where p.group_id = p_group_id
        and p.status in ('generating', 'active')
    );
$$;


--
-- Name: can_pray_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_pray_plan(pid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.has_plan_share(pid)
     or exists (
          select 1
          from public.prayer_plans p
          where p.id = pid
            and p.group_id is not null
            and public.is_group_member(p.group_id)
        );
$$;


--
-- Name: can_pray_plan_day(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_pray_plan_day(did uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.prayer_plan_days d
    where d.id = did
      and d.unlock_date <= public.plan_today(d.plan_id)
      and public.can_pray_plan(d.plan_id)
  );
$$;


--
-- Name: can_read_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_plan(pid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.prayer_plans p
    where p.id = pid
      and (
        p.owner_id = (select auth.uid())
        or public.has_plan_share(p.id)
        or (
          p.group_id is not null
          and exists (
            select 1 from public.group_members m
            where m.group_id = p.group_id
              and m.user_id = (select auth.uid())
          )
        )
        or p.visibility = 'public'
      )
  );
$$;


--
-- Name: can_read_plan_day(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_plan_day(did uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.prayer_plan_days d
    where d.id = did
      and d.unlock_date <= public.plan_today(d.plan_id)
      and public.can_read_plan(d.plan_id)
  );
$$;


--
-- Name: can_read_post(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_post(pid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.posts p
    where p.id = pid
      and p.hidden_at is null
      and p.held_at is null
      and (p.group_id is null or public.is_group_member(p.group_id))
  );
$$;


--
-- Name: circle_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.circle_conversation(p_group_id uuid) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select c.id
  from public.conversations c
  where c.group_id = p_group_id
    and public.is_group_member(p_group_id);
$$;


--
-- Name: circle_invite_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.circle_invite_token(p_group_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select g.invite_token
  from public.groups g
  where g.id = p_group_id
    and public.is_group_member(g.id);
$$;


--
-- Name: circle_messages(uuid, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.circle_messages(p_group_id uuid, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, sender_id uuid, sender_name text, sender_avatar_url text, body text, created_at timestamp with time zone, is_mine boolean)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    m.id,
    m.sender_id,
    pr.display_name,
    pr.avatar_url,
    m.body,
    m.created_at,
    m.sender_id = (select auth.uid())
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.profiles pr on pr.id = m.sender_id
  where c.group_id = p_group_id
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit greatest(least(p_limit, 100), 1);
$$;


--
-- Name: circle_plan(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.circle_plan(p_group_id uuid) RETURNS TABLE(plan_id uuid, title text, theme text, duration_days smallint, status text, day_id uuid, day_number smallint, day_title text, prayed_today boolean, prayed_count integer, finished boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    p.id,
    p.title,
    p.theme,
    p.duration_days,
    p.status::text,
    d.id,
    d.day_number,
    d.title,
    exists (
      select 1 from public.group_prayer_days g
      where g.plan_day_id = d.id and g.user_id = (select auth.uid())
    ),
    (
      select count(*)::integer from public.group_prayer_days g
      where g.plan_day_id = d.id
    ),
    (
      select count(*) >= p.duration_days
        and max(written.unlock_date) < public.plan_today(p.id)
      from public.prayer_plan_days written
      where written.plan_id = p.id
    )
  from public.prayer_plans p
  left join lateral (
    select dd.id, dd.day_number, dd.title
    from public.prayer_plan_days dd
    where dd.plan_id = p.id
      and dd.unlock_date <= public.plan_today(p.id)
    order by dd.day_number desc
    limit 1
  ) d on true
  where p.group_id = p_group_id
    and p.status in ('generating', 'active')
    and public.is_group_member(p_group_id);
$$;


--
-- Name: circle_shared_plans(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.circle_shared_plans(p_group_id uuid) RETURNS TABLE(plan_id uuid, plan_title text, owner_id uuid, owner_name text, is_mine boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    p.id,
    p.title,
    p.owner_id,
    pr.display_name,
    p.owner_id = (select auth.uid())
  from public.plan_shares s
  join public.prayer_plans p on p.id = s.plan_id
  join public.profiles pr on pr.id = p.owner_id
  where s.group_id = p_group_id
    and p.status = 'active'
    and public.is_group_member(p_group_id)
    and not public.has_blocked(p.owner_id)
  order by (p.owner_id = (select auth.uid())) desc, pr.display_name;
$$;


--
-- Name: claim_generation_chunk(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_generation_chunk(p_plan_id uuid, p_request_id uuid, p_lease_seconds integer DEFAULT 300) RETURNS TABLE(reason text, from_day smallint, to_day smallint, lease_id uuid, written smallint, duration_days smallint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid := (select auth.uid());
  v_owner uuid;
  v_status public.plan_status;
  v_duration smallint;
  v_written integer;
  v_from smallint;
  v_to smallint;
  v_settled_from smallint;
  v_settled_to smallint;
  v_lease public.plan_generation_leases;
  v_lease_id uuid;
  v_seconds integer := least(greatest(coalesce(p_lease_seconds, 300), 30), 3600);
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_request_id is null then
    return query select 'request_id_required', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

  -- Keep v5's plan serialization and C0's request lock for the UNIQUE key
  -- shared by all plans. The order is stable for every claim: plan, request.
  perform pg_advisory_xact_lock(hashtextextended(p_plan_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  select p.owner_id, p.duration_days, p.status
    into v_owner, v_duration, v_status
    from public.prayer_plans p
   where p.id = p_plan_id;
  if not found then
    return query select 'not_found', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;
  if v_owner <> v_user then
    return query select 'not_owner', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

  if v_status not in ('generating', 'active') then
    return query select 'not_generatable', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

  if not exists (
    select 1 from public.generation_ledger
     where plan_id = p_plan_id
       and user_id = v_user
       and scope in ('personal', 'circle')
       and status = 'reserved'
  ) then
    return query select 'no_reservation', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

  select l.from_day, l.to_day into v_settled_from, v_settled_to
    from public.generation_ledger l
   where l.request_id = p_request_id
     and l.plan_id = p_plan_id
     and l.user_id = v_user
     and l.scope = 'continuation';
  if found then
    return query select 'already', v_settled_from, v_settled_to,
                        null::uuid,
                        (select count(*)::smallint from public.prayer_plan_days d
                          where d.plan_id = p_plan_id),
                        v_duration;
    return;
  end if;

  -- Same plan + live lease is an idempotent retry.
  select * into v_lease
    from public.plan_generation_leases
   where request_id = p_request_id
     and plan_id = p_plan_id
     and leased_until > now();
  if found then
    return query select 'already', v_lease.from_day, v_lease.to_day,
                        v_lease.lease_id,
                        (select count(*)::smallint from public.prayer_plan_days d
                          where d.plan_id = p_plan_id),
                        v_duration;
    return;
  end if;

  -- A lease from another plan owns this globally-unique request id. Return a
  -- normal reason rather than attempting an INSERT that raises UNIQUE. This
  -- includes an expired lease: its UNIQUE constraint would reject the insert
  -- too, and it may only be reclaimed by its own plan.
  if exists (
    select 1 from public.plan_generation_leases l
     where l.request_id = p_request_id
       and l.plan_id <> p_plan_id
  ) then
    return query select 'request_id_conflict', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

  select count(*) into v_written
    from public.prayer_plan_days d
   where d.plan_id = p_plan_id;

  if v_written >= v_duration then
    return query select 'complete', null::smallint, null::smallint,
                        null::uuid, v_written::smallint, v_duration;
    return;
  end if;

  v_from := v_written + 1;
  v_to := least(v_written + 7, v_duration::integer);

  select * into v_lease
    from public.plan_generation_leases
   where plan_id = p_plan_id;

  if found and v_lease.leased_until > now() then
    return query select 'in_flight', v_lease.from_day, v_lease.to_day,
                        null::uuid, v_written::smallint, v_duration;
    return;
  end if;

  -- ANTES de claimed: el UNIQUE del ledger sobrevive al settle. Cualquier
  -- fila cuyo (plan_id, user_id, scope) no sea esta continuation — incluido
  -- el request_id de la reserva personal/circle — es conflicto. El `already`
  -- de arriba ya cubrió la continuation propia.
  if exists (
    select 1 from public.generation_ledger l
     where l.request_id = p_request_id
  ) then
    return query select 'request_id_conflict', null::smallint, null::smallint,
                        null::uuid, null::smallint, null::smallint;
    return;
  end if;

  v_lease_id := gen_random_uuid();

  if found then
    update public.plan_generation_leases
       set request_id = p_request_id,
           from_day = v_from,
           to_day = v_to,
           lease_id = v_lease_id,
           claimed_by = v_user,
           leased_until = now() + make_interval(secs => v_seconds)
     where plan_id = p_plan_id;
  else
    insert into public.plan_generation_leases
      (plan_id, request_id, from_day, to_day, lease_id, claimed_by, leased_until)
    values
      (p_plan_id, p_request_id, v_from, v_to, v_lease_id, v_user,
       now() + make_interval(secs => v_seconds));
  end if;

  -- A claim is work in flight too. In particular this starts the recovery
  -- clock before the first day exists, when plan_progress intentionally has no
  -- row because of its INNER JOIN.
  update public.prayer_plans
     set generation_heartbeat_at = now()
   where id = p_plan_id;

  return query select 'claimed', v_from, v_to, v_lease_id,
                      v_written::smallint, v_duration;
end;
$$;


--
-- Name: claim_hold(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_hold(p_hold_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_staff() then
    return false;
  end if;

  update public.content_holds
     set status = 'claimed',
         claimed_by = (select auth.uid()),
         claimed_at = now()
   where id = p_hold_id
     and status = 'pending';

  return found;
end;
$$;


--
-- Name: claim_push_outbox_batch(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_push_outbox_batch(p_limit integer DEFAULT 50, p_lease_seconds integer DEFAULT 120) RETURNS TABLE(outbox_id uuid, intercession_id uuid, expo_push_token text, owner_id uuid, owner_name text, intercessor_name text, attempts integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  return query
  with claimable as (
    select o.id
    from public.push_outbox o
    join public.push_devices d on d.id = o.device_id
    join public.intercessions i on i.id = o.intercession_id
    where o.status = 'pending'
      and o.next_attempt_at <= now()
      and (o.leased_until is null or o.leased_until < now())
      and d.revoked_at is null
      and not exists (
        select 1 from public.blocks b
        where b.blocker_id = i.plan_owner_id
          and b.blocked_id = i.intercessor_id
      )
    order by o.created_at
    limit greatest(least(p_limit, 200), 1)
    for update of o skip locked
  ),
  leased as (
    update public.push_outbox o
       set leased_until = now() + (greatest(p_lease_seconds, 1) || ' seconds')::interval
      from claimable c
     where o.id = c.id
    returning o.id, o.intercession_id, o.device_id, o.attempts
  )
  select
    l.id,
    l.intercession_id,
    d.expo_push_token,
    i.plan_owner_id,
    pr.display_name,
    ipr.display_name,
    l.attempts
  from leased l
  join public.push_devices d on d.id = l.device_id
  join public.intercessions i on i.id = l.intercession_id
  join public.profiles pr on pr.id = i.plan_owner_id
  join public.profiles ipr on ipr.id = i.intercessor_id;
end;
$$;


--
-- Name: clear_follows_on_block(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_follows_on_block() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and followee_id = new.blocked_id)
      or (follower_id = new.blocked_id and followee_id = new.blocker_id);

  return new;
end;
$$;


--
-- Name: complete_generation_chunk(uuid, jsonb, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_generation_chunk(p_lease_id uuid, p_days jsonb, p_title text DEFAULT NULL::text, p_theme text DEFAULT NULL::text, p_source_prompt jsonb DEFAULT NULL::jsonb) RETURNS TABLE(ok boolean, reason text, is_complete boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid := (select auth.uid());
  v_plan_id uuid;
  v_lease public.plan_generation_leases;
  v_duration smallint;
  v_written integer;
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  -- Paso 1: resolver el plan_id desde el lease_id. Si el lease ya no existe
  -- (reclaim, settle previo, expiración), salimos sin tocar nada.
  select plan_id into v_plan_id
    from public.plan_generation_leases
   where lease_id = p_lease_id;
  if not found then
    return query select false, 'lease_lost', false;
    return;
  end if;

  -- Paso 2: adquirir el MISMO advisory lock que claim usa para este plan, así
  -- claim y complete no se intercalan. Esto cierra el gap entre el primer
  -- vistazo al lease y la escritura de días.
  perform pg_advisory_xact_lock(hashtextextended(v_plan_id::text, 0));

  -- Paso 3: re-leer el lease BAJO LOCK. Si ya no es el mismo lease_id (fue
  -- reclamado) o venció, no escribimos nada. Así un worker viejo nunca escribe
  -- días ni ledger tras un reclaim.
  select * into v_lease
    from public.plan_generation_leases
   where plan_id = v_plan_id
     and lease_id = p_lease_id
     and leased_until > now();
  if not found then
    return query select false, 'lease_lost', false;
    return;
  end if;

  if v_lease.claimed_by <> v_user then
    raise exception 'complete_generation_chunk: not the lease holder';
  end if;

  select p.duration_days into v_duration
    from public.prayer_plans p
   where p.id = v_lease.plan_id;

  if p_days is not null and jsonb_array_length(p_days) > 0 then
    insert into public.prayer_plan_days
      (plan_id, day_number, title, scripture_ref, scripture_text,
       interpretation, daily_action, prayer_body, intercessor_prayer, unlock_date)
    select v_lease.plan_id,
           (d->>'day_number')::smallint,
           d->>'title',
           nullif(d->>'scripture_ref', ''),
           nullif(d->>'scripture_text', ''),
           nullif(d->>'interpretation', ''),
           nullif(d->>'daily_action', ''),
           d->>'prayer_body',
           nullif(d->>'intercessor_prayer', ''),
           (d->>'unlock_date')::date
      from jsonb_array_elements(p_days) d
    on conflict (plan_id, day_number) do nothing;
  end if;

  -- Heartbeat dedicado de generación (hallazgo 2). Independiente de
  -- `updated_at` (rename/visibility), para que el detector de atascos no
  -- se resetee por acciones que no son de generación.
  update public.prayer_plans
     set generation_heartbeat_at = now()
   where id = v_lease.plan_id;

  if v_lease.from_day = 1 then
    update public.prayer_plans
       set title = coalesce(nullif(btrim(p_title), ''), title),
           theme = p_theme,
           source_prompt = coalesce(p_source_prompt, source_prompt),
           status = 'active'
     where id = v_lease.plan_id
       and status = 'generating';
  elsif v_lease.to_day >= v_duration then
    update public.prayer_plans
       set status = 'active'
     where id = v_lease.plan_id
       and status = 'generating';
  end if;

  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, duration_days,
    from_day, to_day, status
  )
  values (
    v_lease.request_id, v_user, 'continuation', v_lease.plan_id, v_duration,
    v_lease.from_day, v_lease.to_day, 'completed'
  );

  -- Borrar exactamente UNA fila por lease_id. Si ya fue borrada (reclaim),
  -- `v_deleted` será 0 — no fallamos, pero tampoco hicimos transición alguna
  -- porque el otro worker ya tomó el control.
  delete from public.plan_generation_leases where lease_id = p_lease_id;
  get diagnostics v_deleted = row_count;

  select count(*)::integer into v_written
    from public.prayer_plan_days
   where plan_id = v_lease.plan_id;

  return query select true, 'ok', v_written >= v_duration;
end;
$$;


--
-- Name: complete_onboarding(text, jsonb, text, smallint[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_onboarding(p_display_name text, p_answers jsonb, p_timezone text DEFAULT 'UTC'::text, p_reminder_hours smallint[] DEFAULT ARRAY[(8)::smallint], p_locale text DEFAULT 'es'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  current_user_id uuid := (select auth.uid());
  settings public.profile_settings;
  redeemed jsonb := '{}'::jsonb;
  v_reminder_hours smallint[] := coalesce(p_reminder_hours, array[]::smallint[]);
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  update public.profiles
     set display_name = coalesce(nullif(btrim(p_display_name), ''), display_name)
   where id = current_user_id;

  update public.profile_settings
     set onboarding_answers = p_answers,
         timezone = coalesce(nullif(btrim(p_timezone), ''), timezone),
         reminder_hours = v_reminder_hours,
         locale = coalesce(nullif(btrim(p_locale), ''), locale)
   where id = current_user_id
  returning * into settings;

  if not found then
    raise exception 'profile settings missing for %', current_user_id;
  end if;

  if settings.pending_share_token is not null then
    redeemed := redeemed || jsonb_build_object(
      'share', public.redeem_share_token(settings.pending_share_token));
  end if;

  if settings.pending_invite_code is not null then
    redeemed := redeemed || jsonb_build_object(
      'invite', public.redeem_invite_code(settings.pending_invite_code));
  end if;

  update public.profile_settings
     set pending_share_token = null,
         pending_invite_code = null
   where id = current_user_id;

  return jsonb_build_object('ok', true, 'redeemed', redeemed);
end;
$$;


--
-- Name: crisis_queue(timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crisis_queue(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30) RETURNS TABLE(id uuid, target_type text, target_id uuid, author_id uuid, author_name text, body text, created_at timestamp with time zone, acknowledged_by uuid, acknowledged_by_name text, acknowledged_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_staff() then
    return;
  end if;

  return query
  select
    e.id,
    e.target_type,
    e.target_id,
    e.author_id,
    pr.display_name,
    coalesce(po.body, c.body),
    e.created_at,
    e.acknowledged_by,
    apr.display_name,
    e.acknowledged_at
  from public.crisis_escalations e
  join public.profiles pr on pr.id = e.author_id
  left join public.profiles apr on apr.id = e.acknowledged_by
  left join public.posts po on po.id = e.target_id and e.target_type = 'post'
  left join public.comments c on c.id = e.target_id and e.target_type = 'comment'
  where p_before is null or e.created_at < p_before
  order by e.acknowledged_at is not null, e.created_at asc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: delete_my_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_my_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  delete from auth.users where id = caller;
end;
$$;


--
-- Name: enqueue_content_hold(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_content_hold() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.held_at is not null
     and new.crisis_flagged_at is null
     and (tg_op = 'INSERT' or old.held_at is null) then
    insert into public.content_holds (target_type, target_id, author_id)
    values (tg_argv[0], new.id, new.author_id);
  end if;

  return new;
end;
$$;


--
-- Name: enqueue_crisis_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_crisis_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.crisis_flagged_at is not null
     and (tg_op = 'INSERT' or old.crisis_flagged_at is null) then
    insert into public.crisis_escalations (target_type, target_id, author_id)
    values (tg_argv[0], new.id, new.author_id);
  end if;

  return new;
end;
$$;


--
-- Name: enqueue_push_outbox(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_push_outbox() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.push_outbox (intercession_id, device_id)
  select new.id, d.id
  from public.push_devices d
  where d.user_id = new.plan_owner_id
    and d.revoked_at is null
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = new.plan_owner_id
        and b.blocked_id = new.intercessor_id
    );

  return new;
end;
$$;


--
-- Name: ensure_follow(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_follow(p_follower uuid, p_followee uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_follower is null or p_followee is null or p_follower = p_followee then
    return;
  end if;

  -- SECURITY DEFINER se salta la RLS, así que la regla de la policy hay que
  -- repetirla a mano: un enlace compartido no puede colar un seguidor entre dos
  -- personas que se bloquearon.
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_follower and b.blocked_id = p_followee)
       or (b.blocker_id = p_followee and b.blocked_id = p_follower)
  ) then
    return;
  end if;

  insert into public.follows (follower_id, followee_id)
  values (p_follower, p_followee)
  on conflict do nothing;
end;
$$;


--
-- Name: export_my_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.export_my_data() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: fail_generation_chunk(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_generation_chunk(p_lease_id uuid, p_error text) RETURNS TABLE(ok boolean, reason text, plan_failed boolean, retry boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid := (select auth.uid());
  v_plan_id uuid;
  v_lease public.plan_generation_leases;
  v_failures integer;
  v_marked boolean := false;
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select plan_id into v_plan_id
    from public.plan_generation_leases
   where lease_id = p_lease_id;
  if not found then
    return query select false, 'lease_lost', false, false;
    return;
  end if;

  -- Mismo advisory lock que claim/complete/settle.
  perform pg_advisory_xact_lock(hashtextextended(v_plan_id::text, 0));

  -- Re-leer bajo lock: si el lease ya no es el mismo o venció → no-op.
  select * into v_lease
    from public.plan_generation_leases
   where plan_id = v_plan_id
     and lease_id = p_lease_id
     and leased_until > now();
  if not found then
    return query select false, 'lease_lost', false, false;
    return;
  end if;

  if v_lease.claimed_by <> v_user then
    raise exception 'fail_generation_chunk: not the lease holder';
  end if;

  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, duration_days,
    from_day, to_day, status, error
  )
  select v_lease.request_id, v_user, 'continuation', v_lease.plan_id,
         (select duration_days from public.prayer_plans where id = v_lease.plan_id),
         v_lease.from_day, v_lease.to_day, 'failed', p_error;

  if v_lease.from_day = 1 then
    if p_error = 'refused' then
      v_marked := true;
    else
      select count(*) into v_failures
        from public.generation_ledger
       where plan_id = v_lease.plan_id
         and scope = 'continuation'
         and from_day = 1
         and status = 'failed';
      if v_failures >= 3 then
        v_marked := true;
      end if;
    end if;
  end if;

  if v_marked then
    update public.prayer_plans
       set status = 'failed', generation_error = p_error
     where id = v_lease.plan_id
       and status = 'generating'
       and not exists (
         select 1 from public.prayer_plan_days d where d.plan_id = v_lease.plan_id
       );

    v_marked := found;
  end if;

  -- Borrar exactamente UNA fila por lease_id.
  delete from public.plan_generation_leases where lease_id = p_lease_id;
  get diagnostics v_deleted = row_count;

  return query select true, 'ok',
                      v_marked,
                      (v_lease.from_day = 1 and not v_marked and p_error <> 'refused');
end;
$$;


--
-- Name: flag_crisis(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.flag_crisis() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.is_crisis_text(new.body) then
    new.crisis_flagged_at := now();
    -- Oculto para todo el mundo salvo su autor, con el mismo campo que ya
    -- decide eso en la policy — pero NUNCA se enseña como un hold genérico:
    -- el cliente distingue por `crisis_flagged_at`, no por `held_at`.
    new.held_at := now();
  end if;

  return new;
end;
$$;


--
-- Name: flag_enabled(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.flag_enabled(p_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(
    (select f.enabled from public.feature_flags f where f.key = p_key),
    false
  );
$$;


--
-- Name: generate_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_token() RETURNS text
    LANGUAGE sql
    AS $$
  select encode(extensions.gen_random_bytes(16), 'hex');
$$;


--
-- Name: get_circle_invite_preview(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_circle_invite_preview(p_token text) RETURNS TABLE(circle_id uuid, name text, description text, member_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select g.id, g.name, g.description, g.member_count
  from public.groups g
  where g.invite_token = p_token;
$$;


--
-- Name: get_invite_preview(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_invite_preview(p_code text) RETURNS TABLE(inviter_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select p.display_name
  from public.invites i
  join public.profiles p on p.id = i.inviter_id
  where i.code = p_code;
$$;


--
-- Name: get_my_day(uuid, smallint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_day(p_plan_id uuid, p_day_number smallint DEFAULT NULL::smallint) RETURNS TABLE(id uuid, day_number smallint, title text, scripture_ref text, scripture_text text, interpretation text, daily_action text, prayer_body text, unlock_date date, intercession_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    d.id, d.day_number, d.title, d.scripture_ref, d.scripture_text,
    d.interpretation, d.daily_action, d.prayer_body, d.unlock_date,
    d.intercession_count
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.plan_id = p_plan_id
    and p.owner_id = (select auth.uid())
    and d.unlock_date <= public.local_today(p.owner_id)
    and (p_day_number is null or d.day_number = p_day_number)
  order by d.day_number desc
  limit 1;
$$;


--
-- Name: get_public_plan_day(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_plan_day(p_plan_id uuid) RETURNS TABLE(plan_id uuid, plan_title text, plan_theme text, owner_id uuid, owner_name text, owner_avatar_url text, day_number smallint, day_title text, scripture_ref text, scripture_text text, intercession_count integer)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    p.id,
    p.title,
    p.theme,
    p.owner_id,
    pr.display_name,
    pr.avatar_url,
    d.day_number,
    d.title,
    d.scripture_ref,
    d.scripture_text,
    d.intercession_count
  from public.prayer_plans p
  join public.profiles pr on pr.id = p.owner_id
  join lateral (
    select dd.day_number, dd.title, dd.scripture_ref,
           dd.scripture_text, dd.intercession_count
    from public.prayer_plan_days dd
    where dd.plan_id = p.id
    order by dd.day_number desc
    limit 1
  ) d on true
  where p.id = p_plan_id
    and p.visibility = 'public'
    and p.status = 'active'
    and not public.has_blocked(p.owner_id);
$$;


--
-- Name: get_shared_plan_day(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_shared_plan_day(p_plan_id uuid) RETURNS TABLE(plan_id uuid, plan_title text, owner_id uuid, owner_name text, owner_avatar_url text, day_id uuid, day_number smallint, day_title text, scripture_ref text, scripture_text text, intercessor_prayer text, already_prayed boolean)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    p.id,
    p.title,
    p.owner_id,
    pr.display_name,
    pr.avatar_url,
    d.id,
    d.day_number,
    d.title,
    d.scripture_ref,
    d.scripture_text,
    d.intercessor_prayer,
    exists (
      select 1 from public.intercessions i
      where i.plan_day_id = d.id
        and i.intercessor_id = (select auth.uid())
    )
  from public.prayer_plans p
  join public.profiles pr on pr.id = p.owner_id
  join lateral (
    select dd.id, dd.day_number, dd.title, dd.scripture_ref,
           dd.scripture_text, dd.intercessor_prayer
    from public.prayer_plan_days dd
    where dd.plan_id = p.id
    order by dd.day_number desc
    limit 1
  ) d on true
  where p.id = p_plan_id
    and p.owner_id <> (select auth.uid())
    and p.status = 'active'
    and not public.has_blocked(p.owner_id)
    and public.can_pray_plan(p.id);
$$;


--
-- Name: get_shared_plan_preview(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_shared_plan_preview(p_token text) RETURNS TABLE(plan_id uuid, plan_title text, plan_theme text, owner_name text, owner_avatar_url text, day_id uuid, day_number smallint, day_title text, scripture_ref text, scripture_text text, intercessor_prayer text, intercession_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    p.id,
    p.title,
    p.theme,
    pr.display_name,
    pr.avatar_url,
    d.id,
    d.day_number,
    d.title,
    d.scripture_ref,
    d.scripture_text,
    d.intercessor_prayer,
    d.intercession_count
  from public.share_links sl
  join public.prayer_plans p on p.id = sl.plan_id
  join public.profiles pr on pr.id = p.owner_id
  join public.prayer_plan_days d on d.plan_id = p.id
  where sl.token = p_token
    and sl.scope = 'plan'
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now())
    and p.status = 'active'
    and d.unlock_date <= public.local_today(p.owner_id)
  order by d.day_number desc
  limit 1;
$$;


--
-- Name: handle_new_group(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_group() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;


--
-- Name: handle_new_group_conversation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_group_conversation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.conversations (group_id, created_by)
  values (new.id, new.owner_id)
  on conflict (group_id) do nothing;
  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  );

  insert into public.profile_settings (id) values (new.id);

  return new;
end;
$$;


--
-- Name: has_blocked(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_blocked(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.blocks b
    where b.blocker_id = (select auth.uid())
      and b.blocked_id = p_user_id
  );
$$;


--
-- Name: has_plan_share(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_plan_share(pid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.plan_shares s
    where s.plan_id = pid
      and (
        s.shared_with_user_id = (select auth.uid())
        or (
          s.group_id is not null
          and exists (
            select 1
            from public.group_members m
            where m.group_id = s.group_id
              and m.user_id = (select auth.uid())
          )
        )
      )
  );
$$;


--
-- Name: held_content_queue(text[], timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.held_content_queue(p_statuses text[] DEFAULT ARRAY['pending'::text, 'claimed'::text], p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30) RETURNS TABLE(id uuid, target_type text, target_id uuid, author_id uuid, author_name text, body text, status text, claimed_by uuid, claimed_by_name text, reason text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_staff() then
    return;
  end if;

  return query
  select
    h.id,
    h.target_type,
    h.target_id,
    h.author_id,
    pr.display_name,
    coalesce(po.body, c.body),
    h.status,
    h.claimed_by,
    cpr.display_name,
    h.reason,
    h.created_at
  from public.content_holds h
  join public.profiles pr on pr.id = h.author_id
  left join public.profiles cpr on cpr.id = h.claimed_by
  left join public.posts po on po.id = h.target_id and h.target_type = 'post'
  left join public.comments c on c.id = h.target_id and h.target_type = 'comment'
  where h.status = any(p_statuses)
    and (p_before is null or h.created_at < p_before)
  -- Más antiguo primero: es la cola de un SLA, no un muro social.
  order by h.created_at asc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: held_content_queue_page(text[], timestamp with time zone, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.held_content_queue_page(p_statuses text[] DEFAULT ARRAY['pending'::text, 'claimed'::text], p_after timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_after_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, target_type text, target_id uuid, author_id uuid, author_name text, body text, status text, claimed_by uuid, claimed_by_name text, reason text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_staff() then
    return;
  end if;

  return query
  select
    h.id,
    h.target_type,
    h.target_id,
    h.author_id,
    pr.display_name,
    coalesce(po.body, c.body),
    h.status,
    h.claimed_by,
    cpr.display_name,
    h.reason,
    h.created_at
  from public.content_holds h
  join public.profiles pr on pr.id = h.author_id
  left join public.profiles cpr on cpr.id = h.claimed_by
  left join public.posts po on po.id = h.target_id and h.target_type = 'post'
  left join public.comments c on c.id = h.target_id and h.target_type = 'comment'
  where h.status = any(p_statuses)
    and (((p_after is null and p_after_id is null) or (h.created_at, h.id) > (p_after, p_after_id)))
  -- Más antiguo primero: es la cola de un SLA, no un muro social.
  order by h.created_at asc, h.id asc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: hide_comment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hide_comment(p_comment_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_group uuid;
begin
  select p.group_id into v_group
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.id = p_comment_id;

  if v_group is null or not public.is_group_admin(v_group) then
    return false;
  end if;

  update public.comments
     set hidden_at = now(), hidden_by = (select auth.uid())
   where id = p_comment_id and hidden_at is null;

  return found;
end;
$$;


--
-- Name: hide_message(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hide_message(p_message_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_group uuid;
begin
  select c.group_id into v_group
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.id = p_message_id;

  if v_group is null or not public.is_group_admin(v_group) then
    return false;
  end if;

  update public.messages
     set hidden_at = now(),
         hidden_by = (select auth.uid())
   where id = p_message_id
     and hidden_at is null;

  return found;
end;
$$;


--
-- Name: hide_post(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hide_post(p_post_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_group uuid;
begin
  select p.group_id into v_group from public.posts p where p.id = p_post_id;

  if v_group is null or not public.is_group_admin(v_group) then
    return false;
  end if;

  update public.posts
     set hidden_at = now(), hidden_by = (select auth.uid())
   where id = p_post_id and hidden_at is null;

  return found;
end;
$$;


--
-- Name: hide_reported_content(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hide_reported_content(p_report_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_type text;
  v_target uuid;
begin
  if not public.is_staff() then
    return false;
  end if;

  select r.target_type, r.target_id into v_type, v_target
    from public.reports r
   where r.id = p_report_id and r.status = 'open';
  if not found then
    return false;
  end if;

  case v_type
    when 'post' then
      update public.posts
         set hidden_at = coalesce(hidden_at, now()),
             hidden_by = case when hidden_at is null then (select auth.uid()) else hidden_by end
       where id = v_target;
    when 'comment' then
      update public.comments
         set hidden_at = coalesce(hidden_at, now()),
             hidden_by = case when hidden_at is null then (select auth.uid()) else hidden_by end
       where id = v_target;
    when 'message' then
      update public.messages
         set hidden_at = coalesce(hidden_at, now()),
             hidden_by = case when hidden_at is null then (select auth.uid()) else hidden_by end
       where id = v_target;
    else
      return false;
  end case;

  return found;
end;
$$;


--
-- Name: hold_objectionable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hold_objectionable() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.is_objectionable(new.body) then
    new.held_at := now();
  end if;

  return new;
end;
$$;


--
-- Name: home_feed(timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30) RETURNS TABLE(kind text, id uuid, body text, title text, is_anonymous boolean, author_id uuid, author_name text, author_avatar_url text, prayer_count integer, comment_count integer, answered_at timestamp with time zone, held_at timestamp with time zone, crisis_flagged_at timestamp with time zone, created_at timestamp with time zone, i_prayed boolean, is_mine boolean)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
begin
  -- Fail-closed: la comunidad se sirve solo si el flag está encendido. El
  -- chequeo vive en el servidor y ANTES de leer nada, así que OFF es
  -- conjunto vacío —no un filtrado parcial— y un flag desconocido se
  -- comporta igual (fail-closed). Las policies de SELECT de cada fuente
  -- siguen decidiendo exactamente igual para el caso ON.
  if not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  with following as (
    -- Sin alias `as id`: en plpgsql la columna `id` del `returns table` es una
    -- variable OUT y un `id` pelado en una subconsulta quedaría ambiguo. El
    -- nombre `followee_id` no colisiona con ninguna variable.
    select f.followee_id
    from public.follows f
    where f.follower_id = (select auth.uid())
  ),
  everyone as (
    select not exists (select 1 from following) as yes
  ),
  requests as (
    select
      'request'::text as kind,
      p.id,
      p.body,
      null::text as title,
      p.is_anonymous,
      case when p.is_anonymous then null else p.author_id end as author_id,
      case when p.is_anonymous then null else pr.display_name end as author_name,
      case when p.is_anonymous then null else pr.avatar_url end as author_avatar_url,
      p.prayer_count,
      (select count(*)::integer from public.comments c where c.post_id = p.id) as comment_count,
      p.answered_at,
      p.held_at,
      p.crisis_flagged_at,
      p.created_at,
      exists (
        select 1 from public.post_prayers pp
        where pp.post_id = p.id and pp.user_id = (select auth.uid())
      ) as i_prayed,
      p.author_id = (select auth.uid()) as is_mine
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.group_id is null
      and (
        (select yes from everyone)
        or p.author_id in (select followee_id from following)
        or p.author_id = (select auth.uid())
      )
  ),
  stories as (
    select
      'testimony'::text,
      t.id,
      t.body,
      pl.title,
      false,
      t.user_id,
      pr.display_name,
      pr.avatar_url,
      0,
      0,
      null::timestamptz,
      null::timestamptz,
      null::timestamptz,
      t.created_at,
      false,
      t.user_id = (select auth.uid())
    from public.testimonies t
    join public.profiles pr on pr.id = t.user_id
    left join public.prayer_plans pl on pl.id = t.plan_id
    where (
      (select yes from everyone)
      or t.user_id in (select followee_id from following)
      or t.user_id = (select auth.uid())
    )
  ),
  plans as (
    select
      'plan'::text,
      pl.id,
      null::text,
      pl.title,
      false,
      pl.owner_id,
      pr.display_name,
      pr.avatar_url,
      0,
      0,
      null::timestamptz,
      null::timestamptz,
      null::timestamptz,
      pl.created_at,
      false,
      pl.owner_id = (select auth.uid())
    from public.prayer_plans pl
    join public.profiles pr on pr.id = pl.owner_id
    where pl.visibility = 'public'
      and pl.status = 'active'
      and (
        (select yes from everyone)
        or pl.owner_id in (select followee_id from following)
        or pl.owner_id = (select auth.uid())
      )
  ),
  everything as (
    select * from requests
    union all select * from stories
    union all select * from plans
  )
  select *
  from everything e
  where p_before is null or e.created_at < p_before
  order by e.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: home_feed_page(timestamp with time zone, integer, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.home_feed_page(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid, p_before_kind text DEFAULT NULL::text) RETURNS TABLE(kind text, id uuid, body text, title text, is_anonymous boolean, author_id uuid, author_name text, author_avatar_url text, prayer_count integer, comment_count integer, answered_at timestamp with time zone, held_at timestamp with time zone, crisis_flagged_at timestamp with time zone, created_at timestamp with time zone, i_prayed boolean, is_mine boolean)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
begin
  -- Fail-closed: la comunidad se sirve solo si el flag está encendido. El
  -- chequeo vive en el servidor y ANTES de leer nada, así que OFF es
  -- conjunto vacío —no un filtrado parcial— y un flag desconocido se
  -- comporta igual (fail-closed). Las policies de SELECT de cada fuente
  -- siguen decidiendo exactamente igual para el caso ON.
  if not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  with following as (
    -- Sin alias `as id`: en plpgsql la columna `id` del `returns table` es una
    -- variable OUT y un `id` pelado en una subconsulta quedaría ambiguo. El
    -- nombre `followee_id` no colisiona con ninguna variable.
    select f.followee_id
    from public.follows f
    where f.follower_id = (select auth.uid())
  ),
  everyone as (
    select not exists (select 1 from following) as yes
  ),
  requests as (
    select
      'request'::text as kind,
      p.id,
      p.body,
      null::text as title,
      p.is_anonymous,
      case when p.is_anonymous then null else p.author_id end as author_id,
      case when p.is_anonymous then null else pr.display_name end as author_name,
      case when p.is_anonymous then null else pr.avatar_url end as author_avatar_url,
      p.prayer_count,
      (select count(*)::integer from public.comments c where c.post_id = p.id) as comment_count,
      p.answered_at,
      p.held_at,
      p.crisis_flagged_at,
      p.created_at,
      exists (
        select 1 from public.post_prayers pp
        where pp.post_id = p.id and pp.user_id = (select auth.uid())
      ) as i_prayed,
      p.author_id = (select auth.uid()) as is_mine
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.group_id is null
      and (
        (select yes from everyone)
        or p.author_id in (select followee_id from following)
        or p.author_id = (select auth.uid())
      )
  ),
  stories as (
    select
      'testimony'::text,
      t.id,
      t.body,
      pl.title,
      false,
      t.user_id,
      pr.display_name,
      pr.avatar_url,
      0,
      0,
      null::timestamptz,
      null::timestamptz,
      null::timestamptz,
      t.created_at,
      false,
      t.user_id = (select auth.uid())
    from public.testimonies t
    join public.profiles pr on pr.id = t.user_id
    left join public.prayer_plans pl on pl.id = t.plan_id
    where (
      (select yes from everyone)
      or t.user_id in (select followee_id from following)
      or t.user_id = (select auth.uid())
    )
  ),
  plans as (
    select
      'plan'::text,
      pl.id,
      null::text,
      pl.title,
      false,
      pl.owner_id,
      pr.display_name,
      pr.avatar_url,
      0,
      0,
      null::timestamptz,
      null::timestamptz,
      null::timestamptz,
      pl.created_at,
      false,
      pl.owner_id = (select auth.uid())
    from public.prayer_plans pl
    join public.profiles pr on pr.id = pl.owner_id
    where pl.visibility = 'public'
      and pl.status = 'active'
      and (
        (select yes from everyone)
        or pl.owner_id in (select followee_id from following)
        or pl.owner_id = (select auth.uid())
      )
  ),
  everything as (
    select * from requests
    union all select * from stories
    union all select * from plans
  )
  select *
  from everything e
  where ((p_before is null and p_before_id is null and p_before_kind is null) or (e.created_at, e.id, e.kind) < (p_before, p_before_id, p_before_kind))
  order by e.created_at desc, e.id desc, e.kind desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: immutable_unaccent(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.immutable_unaccent(p_text text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    SET search_path TO ''
    AS $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p_text);
$$;


--
-- Name: is_conversation_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_conversation_member(cid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.conversations c
    where c.id = cid
      and (
        (c.group_id is not null and exists (
          select 1 from public.group_members gm
          where gm.group_id = c.group_id
            and gm.user_id = (select auth.uid())
        ))
        or (c.group_id is null and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = (select auth.uid())
        ))
      )
  );
$$;


--
-- Name: is_crisis_text(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_crisis_text(p_text text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare
  v_clean text;
  v_term text;
  v_terms text[] := array[
    'te voy a matar', 'os voy a matar', 'ojala te mueras',
    'quiero matarme', 'me voy a matar', 'voy a suicidarme',
    'quiero suicidarme', 'no quiero seguir viviendo',
    'kill yourself', 'kys', 'i want to die', 'i want to kill myself',
    'i am going to kill myself', 'suicidal'
  ];
begin
  if p_text is null then
    return false;
  end if;

  v_clean := lower(public.immutable_unaccent(p_text));

  foreach v_term in array v_terms loop
    if v_clean ~ ('\m' || v_term || '\M') then
      return true;
    end if;
  end loop;

  return false;
end;
$$;


--
-- Name: is_group_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_group_admin(gid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.group_members m
    where m.group_id = gid
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;


--
-- Name: is_group_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_group_member(gid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.group_members m
    where m.group_id = gid
      and m.user_id = (select auth.uid())
  );
$$;


--
-- Name: is_objectionable(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_objectionable(p_text text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare
  v_clean text;
  v_term text;
  v_terms text[] := array[
    -- Insulto y acoso
    'puta', 'putas', 'puto', 'putos', 'zorra', 'maricon', 'maricones',
    'retrasado', 'retrasada', 'subnormal', 'imbecil', 'idiota',
    'bitch', 'whore', 'faggot', 'retard', 'retarded',
    -- Odio
    'sudaca', 'sudacas', 'negrata', 'moro de mierda',
    'nigger', 'kike', 'tranny',
    -- Sexual explícito
    'porno', 'pornografia', 'xxx', 'onlyfans',
    'porn', 'nudes',
    -- Estafa y spam
    'bitcoin gratis', 'dinero facil', 'gana dinero desde casa',
    'free bitcoin', 'crypto giveaway'
  ];
begin
  if p_text is null then
    return false;
  end if;

  v_clean := lower(public.immutable_unaccent(p_text));

  foreach v_term in array v_terms loop
    if v_clean ~ ('\m' || v_term || '\M') then
      return true;
    end if;
  end loop;

  return false;
end;
$$;


--
-- Name: is_staff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(
    (select p.is_staff from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;


--
-- Name: join_group_with_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_group_with_token(token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  target_group uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select g.id into target_group
  from public.groups g
  where g.invite_token = token;

  if target_group is null then
    raise exception 'invalid invite token';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group, current_user_id, 'member')
  on conflict (group_id, user_id) do nothing;

  return target_group;
end;
$$;


--
-- Name: local_today(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.local_today(p_user uuid) RETURNS date
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  tz text;
begin
  select ps.timezone into tz
  from public.profile_settings ps
  where ps.id = p_user;

  if tz is null or btrim(tz) = '' then
    tz := 'UTC';
  end if;

  return (now() at time zone tz)::date;
exception
  when others then
    -- An unparseable stored timezone must not make someone's day unreadable.
    -- Falling back to UTC is the old behaviour: wrong by hours, never broken.
    return (now() at time zone 'UTC')::date;
end;
$$;


--
-- Name: locate_reference(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.locate_reference(p_ref text) RETURNS TABLE(book_id smallint, chapter smallint, verse smallint)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $_$
declare
  parts text[];
  normalised text;
  resolved_book smallint;
  ch smallint;
  v smallint;
  max_chapter smallint;
begin
  -- book [chapter [: verse]]
  parts := regexp_match(
    coalesce(p_ref, ''),
    '^\s*(.+?)(?:\s+(\d+)(?:\s*[:.]\s*(\d+))?)?\s*$'
  );

  if parts is null then
    return;
  end if;

  normalised := public.normalize_book_name(parts[1]);

  select a.book_id into resolved_book
  from public.bible_book_aliases a
  where a.alias = normalised;

  -- Same unique-prefix fallback as resolve_scripture: "1 C" is ambiguous
  -- between Corintios and Crónicas and must fail rather than guess.
  if resolved_book is null then
    select case when count(*) = 1 then min(candidates.book_id) end
      into resolved_book
    from (
      select distinct a.book_id
      from public.bible_book_aliases a
      where char_length(normalised) >= 3
        and a.alias like normalised || '%'
    ) as candidates;
  end if;

  if resolved_book is null then
    return;
  end if;

  ch := coalesce(parts[2]::smallint, 1::smallint);
  v := coalesce(parts[3]::smallint, 1::smallint);

  select b.chapter_count into max_chapter
  from public.bible_books b
  where b.id = resolved_book;

  if ch < 1 or ch > max_chapter then
    return;
  end if;

  -- A verse that does not exist sends the reader nowhere useful, so fail
  -- rather than land them on a chapter with nothing highlighted.
  if not exists (
    select 1 from public.bible_verses bv
    where bv.book_id = resolved_book and bv.chapter = ch and bv.verse = v
  ) then
    return;
  end if;

  book_id := resolved_book;
  chapter := ch;
  verse := v;

  return next;
end;
$_$;


--
-- Name: mark_circle_day(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_circle_day(p_plan_day_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid := (select auth.uid());
  v_group uuid;
begin
  select p.group_id into v_group
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.id = p_plan_day_id
    and d.unlock_date <= public.plan_today(p.id);

  if v_group is null then
    return false;
  end if;

  if not exists (
    select 1 from public.group_members m
    where m.group_id = v_group and m.user_id = v_user
  ) then
    return false;
  end if;

  -- Pulsar dos veces, o desde dos dispositivos, no es un fallo: oraste. Los
  -- dos índices únicos lo absorben.
  insert into public.prayer_logs (user_id, plan_day_id)
  values (v_user, p_plan_day_id)
  on conflict (user_id, plan_day_id) do nothing;

  insert into public.group_prayer_days (group_id, plan_day_id, user_id)
  values (v_group, p_plan_day_id, v_user)
  on conflict (group_id, plan_day_id, user_id) do nothing;

  return true;
end;
$$;


--
-- Name: mark_conversation_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_conversation_read(p_group_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid := (select auth.uid());
  v_conversation uuid;
begin
  select c.id into v_conversation
  from public.conversations c
  where c.group_id = p_group_id;

  if v_conversation is null or not public.is_group_member(p_group_id) then
    return;
  end if;

  insert into public.conversation_members (conversation_id, user_id, last_read_at)
  values (v_conversation, v_user, now())
  on conflict (conversation_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;


--
-- Name: mark_notifications_read(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notifications_read() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_count integer;
begin
  update public.notifications
     set read_at = now()
   where user_id = (select auth.uid())
     and read_at is null;

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;


--
-- Name: mark_push_delivery(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_push_delivery(p_outbox_id uuid, p_status text, p_receipt_id text DEFAULT NULL::text, p_error text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_device_id uuid;
  v_attempts integer;
  -- Tope real: a partir de este número de intentos, un reintentable deja de
  -- reintentarse y se da por perdido — pero sin la connotación de "token
  -- muerto", que solo la afirma el proveedor, nunca el conteo de intentos.
  v_max_attempts constant integer := 8;
begin
  if p_status not in ('sent', 'delivered', 'permanent_failure', 'retryable_failure') then
    raise exception 'mark_push_delivery requires a known outcome (sent, delivered, permanent_failure, retryable_failure)';
  end if;

  if p_status = 'sent' then
    update public.push_outbox
       set status = 'sent',
           sent_at = now(),
           receipt_id = coalesce(p_receipt_id, receipt_id),
           last_error = null,
           leased_until = null
     where id = p_outbox_id
       and status = 'pending'
    returning device_id into v_device_id;

    return v_device_id is not null;
  end if;

  if p_status = 'delivered' then
    update public.push_outbox
       set status = 'delivered',
           delivered_at = now(),
           receipt_id = coalesce(p_receipt_id, receipt_id),
           leased_until = null
     where id = p_outbox_id
       and status = 'sent'
    returning device_id into v_device_id;

    return v_device_id is not null;
  end if;

  if p_status = 'permanent_failure' then
    update public.push_outbox
       set status = 'failed',
           attempts = attempts + 1,
           last_error = coalesce(p_error, 'permanent_failure'),
           leased_until = null
     where id = p_outbox_id
       and status in ('pending', 'sent')
    returning device_id into v_device_id;

    if v_device_id is null then
      return false;
    end if;

    -- El motivo de por qué esto es lo único que revoca: un `DeviceNotRegistered`
    -- (o equivalente) lo dice el proveedor sobre el token en sí, no sobre este
    -- envío — el token está muerto para cualquier fila futura, no solo esta.
    update public.push_devices
       set revoked_at = now()
     where id = v_device_id
       and revoked_at is null;

    return true;
  end if;

  -- retryable_failure: transporte, rate limit, error genérico del proveedor —
  -- cualquier cosa que no afirme que el token ya no existe.
  select attempts into v_attempts
    from public.push_outbox
   where id = p_outbox_id
     and status = 'pending';

  if v_attempts is null then
    return false;
  end if;

  if v_attempts + 1 >= v_max_attempts then
    -- Tope agotado: se da por perdido, pero como `failed` sin revocar nada —
    -- agotar reintentos no es la misma afirmación que "el token no existe".
    update public.push_outbox
       set status = 'failed',
           attempts = attempts + 1,
           last_error = coalesce(p_error, 'retry_limit_exceeded'),
           leased_until = null
     where id = p_outbox_id;

    return true;
  end if;

  -- Backoff exponencial con techo, en segundos: 2, 4, 8, 16, 32, 60, 60, ...
  update public.push_outbox
     set attempts = attempts + 1,
         last_error = p_error,
         next_attempt_at = now() + (least(power(2, attempts + 1), 60) * interval '1 second'),
         leased_until = null
   where id = p_outbox_id;

  return true;
end;
$$;


--
-- Name: my_notifications(timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_notifications(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30) RETURNS TABLE(id uuid, type text, payload jsonb, read_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select n.id, n.type, n.payload, n.read_at, n.created_at
  from public.notifications n
  where n.user_id = (select auth.uid())
    and not public.has_blocked((n.payload ->> 'intercessor_id')::uuid)
    and (p_before is null or n.created_at < p_before)
  order by n.created_at desc
  limit greatest(least(p_limit, 100), 1);
$$;


--
-- Name: my_notifications_page(timestamp with time zone, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_notifications_page(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, type text, payload jsonb, read_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select n.id, n.type, n.payload, n.read_at, n.created_at
  from public.notifications n
  where n.user_id = (select auth.uid())
    and not public.has_blocked((n.payload ->> 'intercessor_id')::uuid)
    and (((p_before is null and p_before_id is null) or (n.created_at, n.id) < (p_before, p_before_id)))
  order by n.created_at desc, n.id desc
  limit greatest(least(p_limit, 100), 1);
$$;


--
-- Name: my_plan_days(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_plan_days(p_plan_id uuid) RETURNS TABLE(id uuid, day_number smallint, title text, scripture_ref text, prayed boolean, unlock_date date, unlocked boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    case when d.unlock_date <= public.local_today(p.owner_id) then d.id end,
    d.day_number,
    -- El título de un día que aún no toca es contenido: se queda fuera.
    case when d.unlock_date <= public.local_today(p.owner_id) then d.title end,
    case when d.unlock_date <= public.local_today(p.owner_id)
         then d.scripture_ref end,
    exists (
      select 1 from public.prayer_logs l
      where l.plan_day_id = d.id and l.user_id = (select auth.uid())
    ),
    d.unlock_date,
    d.unlock_date <= public.local_today(p.owner_id)
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.plan_id = p_plan_id
    and p.owner_id = (select auth.uid())
  order by d.day_number desc;
$$;


--
-- Name: my_profile_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_profile_data() RETURNS TABLE(is_staff boolean, streak_count integer, streak_last_day date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select is_staff, streak_count, streak_last_day
  from public.profiles
  where id = (select auth.uid());
$$;


--
-- Name: my_unread_counts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_unread_counts() RETURNS TABLE(group_id uuid, unread integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    c.group_id,
    count(m.id)::integer
  from public.conversations c
  join public.group_members gm
    on gm.group_id = c.group_id and gm.user_id = (select auth.uid())
  left join public.conversation_members cm
    on cm.conversation_id = c.id and cm.user_id = (select auth.uid())
  left join public.messages m
    on m.conversation_id = c.id
   and m.sender_id <> (select auth.uid())
   and m.hidden_at is null
   and not exists (
     select 1 from public.blocks b
     where b.blocker_id = (select auth.uid())
       and b.blocked_id = m.sender_id
   )
   -- Sin marca de lectura, todo lo que no es tuyo está sin leer: es la primera
   -- vez que abres ese chat.
   and (cm.last_read_at is null or m.created_at > cm.last_read_at)
  where c.group_id is not null
  group by c.group_id;
$$;


--
-- Name: my_unread_notifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_unread_notifications() RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select count(*)::integer
  from public.notifications n
  where n.user_id = (select auth.uid())
    and n.read_at is null
    and not public.has_blocked((n.payload ->> 'intercessor_id')::uuid);
$$;


--
-- Name: normalize_book_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_book_name(p_name text) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select btrim(
    regexp_replace(
      lower(extensions.unaccent(coalesce(p_name, ''))),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;


--
-- Name: normalize_settings_timezone(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_settings_timezone() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  new.timezone := public.valid_timezone(new.timezone);
  return new;
end;
$$;


--
-- Name: notify_on_intercession(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_on_intercession() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  intercessor_name text;
  plan_title text;
begin
  select p.display_name into intercessor_name
  from public.profiles p
  where p.id = new.intercessor_id;

  select pl.title into plan_title
  from public.prayer_plan_days d
  join public.prayer_plans pl on pl.id = d.plan_id
  where d.id = new.plan_day_id;

  insert into public.notifications (user_id, type, payload, dedupe_key)
  values (
    new.plan_owner_id,
    'intercession',
    jsonb_build_object(
      'intercession_id', new.id,
      'plan_day_id', new.plan_day_id,
      'intercessor_id', new.intercessor_id,
      'intercessor_name', intercessor_name,
      'plan_title', plan_title
    ),
    'intercession:' || new.intercessor_id::text || ':' || current_date::text
  )
  on conflict do nothing;

  return new;
end;
$$;


--
-- Name: open_crisis_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_crisis_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case
    when public.is_staff() then
      (select count(*)::integer from public.crisis_escalations
        where acknowledged_at is null)
    else 0
  end;
$$;


--
-- Name: open_crisis_queue(timestamp with time zone, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_crisis_queue(p_after timestamp with time zone DEFAULT NULL::timestamp with time zone, p_after_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30) RETURNS TABLE(id uuid, target_type text, target_id uuid, author_id uuid, author_name text, body text, created_at timestamp with time zone, acknowledged_by uuid, acknowledged_by_name text, acknowledged_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_staff() then
    return;
  end if;
  if (p_after is null) <> (p_after_id is null) then
    raise exception 'both cursor fields are required' using errcode = '22023';
  end if;

  return query
  select e.id, e.target_type, e.target_id, e.author_id, pr.display_name,
         coalesce(po.body, c.body), e.created_at,
         e.acknowledged_by, null::text, e.acknowledged_at
  from public.crisis_escalations e
  join public.profiles pr on pr.id = e.author_id
  left join public.posts po on po.id = e.target_id and e.target_type = 'post'
  left join public.comments c on c.id = e.target_id and e.target_type = 'comment'
  where e.acknowledged_at is null
    and (p_after is null or (e.created_at, e.id) > (p_after, p_after_id))
  order by e.created_at asc, e.id asc
  limit greatest(least(coalesce(p_limit, 30), 50), 1);
end;
$$;


--
-- Name: open_hold_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_hold_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case
    when public.is_staff() then
      (select count(*)::integer from public.content_holds
        where status in ('pending', 'claimed'))
    else 0
  end;
$$;


--
-- Name: open_report_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_report_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case
    when public.is_staff() then
      (select count(*)::integer from public.reports where status = 'open')
    else 0
  end;
$$;


--
-- Name: pending_push_outbox(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pending_push_outbox(p_limit integer DEFAULT 50) RETURNS TABLE(outbox_id uuid, intercession_id uuid, expo_push_token text, owner_id uuid, owner_name text, intercessor_name text, attempts integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    o.id,
    o.intercession_id,
    d.expo_push_token,
    i.plan_owner_id,
    pr.display_name,
    ipr.display_name,
    o.attempts
  from public.push_outbox o
  join public.push_devices d on d.id = o.device_id
  join public.intercessions i on i.id = o.intercession_id
  join public.profiles pr on pr.id = i.plan_owner_id
  join public.profiles ipr on ipr.id = i.intercessor_id
  where o.status = 'pending'
    and o.next_attempt_at <= now()
    and (o.leased_until is null or o.leased_until < now())
    and d.revoked_at is null
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = i.plan_owner_id
        and b.blocked_id = i.intercessor_id
    )
  order by o.created_at
  limit greatest(least(p_limit, 200), 1);
$$;


--
-- Name: person_plans(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.person_plans(p_user_id uuid, p_limit integer DEFAULT 20) RETURNS TABLE(id uuid, title text, duration_days smallint, created_at timestamp with time zone, is_mine boolean)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
begin
  if not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  select
    p.id,
    p.title,
    p.duration_days,
    p.created_at,
    p.owner_id = (select auth.uid())
  from public.prayer_plans p
  where p.owner_id = p_user_id
    and p.visibility = 'public'
    and p.status = 'active'
  order by p.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: person_posts(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.person_posts(p_user_id uuid, p_limit integer DEFAULT 20) RETURNS TABLE(id uuid, body text, prayer_count integer, comment_count integer, answered_at timestamp with time zone, created_at timestamp with time zone, i_prayed boolean, is_mine boolean)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
begin
  if not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  select
    p.id,
    p.body,
    p.prayer_count,
    (select count(*)::integer from public.comments c where c.post_id = p.id) as comment_count,
    p.answered_at,
    p.created_at,
    exists (
      select 1 from public.post_prayers pp
      where pp.post_id = p.id and pp.user_id = (select auth.uid())
    ),
    p.author_id = (select auth.uid())
  from public.posts p
  where p.author_id = p_user_id
    and p.group_id is null
    and not p.is_anonymous
  order by p.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: plan_progress(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.plan_progress(p_plan_id uuid) RETURNS TABLE(days_total smallint, days_written integer, days_unlocked integer, days_prayed integer, intercessions_received integer, finished boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    p.duration_days,
    count(d.id)::integer,
    count(d.id) filter (
      where d.unlock_date <= public.local_today(p.owner_id)
    )::integer,
    count(l.id)::integer,
    coalesce(sum(d.intercession_count), 0)::integer,
    count(d.id) >= p.duration_days
      and max(d.unlock_date) < public.local_today(p.owner_id)
  from public.prayer_plans p
  join public.prayer_plan_days d on d.plan_id = p.id
  -- El left join es contra los registros *del dueño*: `prayer_logs` solo lo lee
  -- su dueño por policy, y esta función es definer, así que sin acotar por
  -- `user_id` contaría los de cualquiera.
  left join public.prayer_logs l
    on l.plan_day_id = d.id and l.user_id = p.owner_id
  where p.id = p_plan_id
    and p.owner_id = (select auth.uid())
  group by p.id, p.duration_days, p.owner_id;
$$;


--
-- Name: plan_today(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.plan_today(p_plan uuid) RETURNS date
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.local_today(p.owner_id)
  from public.prayer_plans p
  where p.id = p_plan;
$$;


--
-- Name: plan_written_days(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.plan_written_days(p_plan_id uuid) RETURNS TABLE(day_number smallint, title text, scripture_ref text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select d.day_number, d.title, d.scripture_ref
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.plan_id = p_plan_id
    and p.owner_id = (select auth.uid())
  order by d.day_number;
$$;


--
-- Name: plans_shared_with_me(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.plans_shared_with_me() RETURNS TABLE(plan_id uuid, plan_title text, owner_id uuid, owner_name text, owner_avatar_url text, day_id uuid, day_number smallint, day_title text, scripture_ref text, scripture_text text, intercessor_prayer text, already_prayed boolean)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select *
  from (
    select
      p.id as plan_id,
      p.title as plan_title,
      p.owner_id as owner_id,
      pr.display_name as owner_name,
      pr.avatar_url as owner_avatar_url,
      d.id as day_id,
      d.day_number as day_number,
      d.title as day_title,
      d.scripture_ref as scripture_ref,
      d.scripture_text as scripture_text,
      d.intercessor_prayer as intercessor_prayer,
      exists (
        select 1 from public.intercessions i
        where i.plan_day_id = d.id
          and i.intercessor_id = (select auth.uid())
      ) as already_prayed
    from public.prayer_plans p
    join public.profiles pr on pr.id = p.owner_id
    join lateral (
      select dd.id, dd.day_number, dd.title, dd.scripture_ref,
             dd.scripture_text, dd.intercessor_prayer
      from public.prayer_plan_days dd
      where dd.plan_id = p.id
      order by dd.day_number desc
      limit 1
    ) d on true
    where p.owner_id <> (select auth.uid())
      and p.status = 'active'
      and not public.has_blocked(p.owner_id)
      -- La línea del contrato: share explícito o círculo. Un plan solo
      -- público ya no entra aquí aunque la policy lo haga legible.
      and public.can_pray_plan(p.id)
  ) rows
  order by rows.already_prayed, rows.owner_name;
$$;


--
-- Name: post_comments(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_comments(p_post_id uuid) RETURNS TABLE(id uuid, body text, author_id uuid, author_name text, author_avatar_url text, held_at timestamp with time zone, crisis_flagged_at timestamp with time zone, created_at timestamp with time zone, is_mine boolean)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    c.id,
    c.body,
    c.author_id,
    pr.display_name,
    pr.avatar_url,
    c.held_at,
    c.crisis_flagged_at,
    c.created_at,
    c.author_id = (select auth.uid())
  from public.comments c
  join public.profiles pr on pr.id = c.author_id
  where c.post_id = p_post_id
  order by c.created_at;
$$;


--
-- Name: prayer_feed(uuid, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prayer_feed(p_group_id uuid DEFAULT NULL::uuid, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30) RETURNS TABLE(id uuid, body text, is_anonymous boolean, author_id uuid, author_name text, author_avatar_url text, prayer_count integer, comment_count integer, answered_at timestamp with time zone, held_at timestamp with time zone, crisis_flagged_at timestamp with time zone, created_at timestamp with time zone, i_prayed boolean, is_mine boolean)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
begin
  -- El muro abierto (sin círculo) es comunidad y responde al flag; el feed de
  -- un círculo concreto no lo es. OFF cierra la pared pública y deja intactos
  -- los círculos, que son otra superficie.
  if p_group_id is null and not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  select
    p.id,
    p.body,
    p.is_anonymous,
    case when p.is_anonymous then null else p.author_id end,
    case when p.is_anonymous then null else pr.display_name end,
    case when p.is_anonymous then null else pr.avatar_url end,
    p.prayer_count,
    (select count(*)::integer from public.comments c where c.post_id = p.id) as comment_count,
    p.answered_at,
    p.held_at,
    p.crisis_flagged_at,
    p.created_at,
    exists (
      select 1 from public.post_prayers pp
      where pp.post_id = p.id and pp.user_id = (select auth.uid())
    ),
    p.author_id = (select auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where (
      (p_group_id is null and p.group_id is null)
      or p.group_id = p_group_id
    )
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: prayer_feed_page(uuid, timestamp with time zone, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prayer_feed_page(p_group_id uuid DEFAULT NULL::uuid, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, body text, is_anonymous boolean, author_id uuid, author_name text, author_avatar_url text, prayer_count integer, comment_count integer, answered_at timestamp with time zone, held_at timestamp with time zone, crisis_flagged_at timestamp with time zone, created_at timestamp with time zone, i_prayed boolean, is_mine boolean)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
begin
  -- El muro abierto (sin círculo) es comunidad y responde al flag; el feed de
  -- un círculo concreto no lo es. OFF cierra la pared pública y deja intactos
  -- los círculos, que son otra superficie.
  if p_group_id is null and not public.flag_enabled('community_feed') then
    return;
  end if;

  return query
  select
    p.id,
    p.body,
    p.is_anonymous,
    case when p.is_anonymous then null else p.author_id end,
    case when p.is_anonymous then null else pr.display_name end,
    case when p.is_anonymous then null else pr.avatar_url end,
    p.prayer_count,
    (select count(*)::integer from public.comments c where c.post_id = p.id) as comment_count,
    p.answered_at,
    p.held_at,
    p.crisis_flagged_at,
    p.created_at,
    exists (
      select 1 from public.post_prayers pp
      where pp.post_id = p.id and pp.user_id = (select auth.uid())
    ),
    p.author_id = (select auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where (
      (p_group_id is null and p.group_id is null)
      or p.group_id = p_group_id
    )
    and (((p_before is null and p_before_id is null) or (p.created_at, p.id) < (p_before, p_before_id)))
  order by p.created_at desc, p.id desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: protect_group_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_group_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid;
begin
  select g.owner_id into v_owner
  from public.groups g
  where g.id = old.group_id;

  -- Salirse uno mismo sí se permite: es el dueño decidiendo, y el círculo
  -- sigue siendo suyo. Lo que no se permite es que lo eche otro.
  if old.user_id = v_owner and old.user_id <> (select auth.uid()) then
    raise exception 'cannot remove the circle owner';
  end if;

  return old;
end;
$$;


--
-- Name: public_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.public_profile(p_user_id uuid) RETURNS TABLE(id uuid, display_name text, avatar_url text, member_since date, shares_circle boolean, is_me boolean, i_follow boolean, follower_count integer, following_count integer, streak integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.created_at::date,
    public.shares_a_circle_with(p.id),
    p.id = (select auth.uid()),
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid())
        and f.followee_id = p.id
    ),
    p.follower_count,
    p.following_count,
    -- La misma regla de gracia que `bump_personal_streak`: un día perdido se
    -- perdona, dos seguidos reinician.
    case
      when p.streak_last_day is null then 0
      when p.streak_last_day >= public.local_today(p.id) - 2 then p.streak_count
      else 0
    end
  from public.profiles p
  where p.id = p_user_id
    -- Bloquear es de una sola dirección en toda la app: deja de llegarte lo
    -- suyo, y a la otra persona no se le dice nada ni se le cierra nada. Aquí
    -- igual, para no inventar una regla distinta en una pantalla suelta.
    and not public.has_blocked(p.id);
$$;


--
-- Name: redeem_invite_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_invite_code(p_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  inv public.invites;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into inv
  from public.invites i
  where i.code = p_code;

  if inv is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if inv.inviter_id = current_user_id then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  -- First acceptance wins; later ones still create the follow so a code
  -- forwarded around a family chat keeps working.
  if inv.accepted_by is null then
    update public.invites
       set accepted_by = current_user_id,
           accepted_at = now()
     where id = inv.id;
  end if;

  perform public.ensure_follow(current_user_id, inv.inviter_id);

  return jsonb_build_object('ok', true, 'inviter_id', inv.inviter_id);
end;
$$;


--
-- Name: redeem_share_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_share_token(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  link public.share_links;
  plan_owner uuid;
  circle_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  select * into link
  from public.share_links sl
  where sl.token = p_token
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > now());

  if link is null then
    -- Not a share link. It may be a circle invitation.
    select g.id into circle_id
    from public.groups g
    where g.invite_token = p_token;

    if circle_id is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
    end if;

    insert into public.group_members (group_id, user_id, role)
    values (circle_id, current_user_id, 'member')
    on conflict (group_id, user_id) do nothing;

    return jsonb_build_object('ok', true, 'scope', 'circle',
                              'circle_id', circle_id);
  end if;

  if link.scope = 'plan' then
    select p.owner_id into plan_owner
    from public.prayer_plans p
    where p.id = link.plan_id;

    if plan_owner is null then
      return jsonb_build_object('ok', false, 'reason', 'plan_missing');
    end if;

    if plan_owner = current_user_id then
      return jsonb_build_object('ok', true, 'scope', 'plan',
                                'plan_id', link.plan_id, 'self', true);
    end if;

    insert into public.plan_shares (plan_id, shared_with_user_id, created_by)
    values (link.plan_id, current_user_id, plan_owner)
    on conflict do nothing;

    -- El acceso al plan lo da `plan_shares`, arriba. Esto es otra cosa: quien
    -- abre el enlace pasa a seguir a quien lo mandó. En una dirección — a la
    -- otra persona no se le añade nada.
    perform public.ensure_follow(current_user_id, plan_owner);

    return jsonb_build_object('ok', true, 'scope', 'plan',
                              'plan_id', link.plan_id);
  else
    insert into public.group_members (group_id, user_id, role)
    values (link.group_id, current_user_id, 'member')
    on conflict (group_id, user_id) do nothing;

    return jsonb_build_object('ok', true, 'scope', 'group',
                              'group_id', link.group_id);
  end if;
end;
$$;


--
-- Name: register_push_device(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_push_device(p_token text, p_platform text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_token is null or char_length(btrim(p_token)) = 0 then
    raise exception 'register_push_device requires a token';
  end if;

  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'register_push_device requires a valid platform';
  end if;

  insert into public.push_devices (user_id, expo_push_token, platform)
  values ((select auth.uid()), btrim(p_token), p_platform)
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        last_used_at = now(),
        revoked_at = null;

  return true;
end;
$$;


--
-- Name: release_hold(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_hold(p_hold_id uuid, p_reason text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_target_type text;
  v_target_id uuid;
begin
  if not public.is_staff() then
    return false;
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'release_hold requires a reason';
  end if;

  select h.target_type, h.target_id into v_target_type, v_target_id
  from public.content_holds h
  where h.id = p_hold_id
    and h.status in ('pending', 'claimed');

  if v_target_id is null then
    return false;
  end if;

  update public.content_holds
     set status = 'released',
         resolved_by = (select auth.uid()),
         resolved_at = now(),
         reason = btrim(p_reason)
   where id = p_hold_id;

  if v_target_type = 'post' then
    update public.posts set held_at = null where id = v_target_id;
  else
    update public.comments set held_at = null where id = v_target_id;
  end if;

  return true;
end;
$$;


--
-- Name: remove_hold(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_hold(p_hold_id uuid, p_reason text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_target_type text;
  v_target_id uuid;
begin
  if not public.is_staff() then
    return false;
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'remove_hold requires a reason';
  end if;

  select h.target_type, h.target_id into v_target_type, v_target_id
  from public.content_holds h
  where h.id = p_hold_id
    and h.status in ('pending', 'claimed');

  if v_target_id is null then
    return false;
  end if;

  update public.content_holds
     set status = 'removed',
         resolved_by = (select auth.uid()),
         resolved_at = now(),
         reason = btrim(p_reason)
   where id = p_hold_id;

  if v_target_type = 'post' then
    update public.posts
       set hidden_at = now(), hidden_by = (select auth.uid())
     where id = v_target_id;
  else
    update public.comments
       set hidden_at = now(), hidden_by = (select auth.uid())
     where id = v_target_id;
  end if;

  return true;
end;
$$;


--
-- Name: report_queue(public.report_status, timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.report_queue(p_status public.report_status DEFAULT 'open'::public.report_status, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30) RETURNS TABLE(id uuid, target_type text, target_id uuid, reason text, status public.report_status, created_at timestamp with time zone, reporter_name text, author_id uuid, author_name text, content text, already_hidden boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_staff() then
    return;
  end if;

  return query
  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at,
    rp.display_name,
    -- Quién escribió lo reportado, para poder ir a su perfil y ver si es la
    -- tercera vez esta semana.
    coalesce(po.author_id, c.author_id, m.sender_id, t.user_id, i.intercessor_id),
    coalesce(pa.display_name, ca.display_name, ma.display_name,
             ta.display_name, ia.display_name),
    -- El texto. Una intercesión reportada es su mensaje: el gesto en sí no se
    -- reporta, se reporta lo que alguien escribió con él.
    coalesce(po.body, c.body, m.body, t.body, i.message),
    coalesce(po.hidden_at, c.hidden_at, m.hidden_at) is not null
  from public.reports r
  join public.profiles rp on rp.id = r.reporter_id
  left join public.posts po on po.id = r.target_id and r.target_type = 'post'
  left join public.profiles pa on pa.id = po.author_id
  left join public.comments c on c.id = r.target_id and r.target_type = 'comment'
  left join public.profiles ca on ca.id = c.author_id
  left join public.messages m on m.id = r.target_id and r.target_type = 'message'
  left join public.profiles ma on ma.id = m.sender_id
  left join public.testimonies t on t.id = r.target_id and r.target_type = 'testimony'
  left join public.profiles ta on ta.id = t.user_id
  left join public.intercessions i on i.id = r.target_id and r.target_type = 'intercession'
  left join public.profiles ia on ia.id = i.intercessor_id
  where r.status = p_status
    and (p_before is null or r.created_at < p_before)
  order by r.created_at desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: report_queue_page(public.report_status, timestamp with time zone, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.report_queue_page(p_status public.report_status DEFAULT 'open'::public.report_status, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, target_type text, target_id uuid, reason text, status public.report_status, created_at timestamp with time zone, reporter_name text, author_id uuid, author_name text, content text, already_hidden boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_staff() then
    return;
  end if;

  return query
  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at,
    rp.display_name,
    -- Quién escribió lo reportado, para poder ir a su perfil y ver si es la
    -- tercera vez esta semana.
    coalesce(po.author_id, c.author_id, m.sender_id, t.user_id, i.intercessor_id),
    coalesce(pa.display_name, ca.display_name, ma.display_name,
             ta.display_name, ia.display_name),
    -- El texto. Una intercesión reportada es su mensaje: el gesto en sí no se
    -- reporta, se reporta lo que alguien escribió con él.
    coalesce(po.body, c.body, m.body, t.body, i.message),
    coalesce(po.hidden_at, c.hidden_at, m.hidden_at) is not null
  from public.reports r
  join public.profiles rp on rp.id = r.reporter_id
  left join public.posts po on po.id = r.target_id and r.target_type = 'post'
  left join public.profiles pa on pa.id = po.author_id
  left join public.comments c on c.id = r.target_id and r.target_type = 'comment'
  left join public.profiles ca on ca.id = c.author_id
  left join public.messages m on m.id = r.target_id and r.target_type = 'message'
  left join public.profiles ma on ma.id = m.sender_id
  left join public.testimonies t on t.id = r.target_id and r.target_type = 'testimony'
  left join public.profiles ta on ta.id = t.user_id
  left join public.intercessions i on i.id = r.target_id and r.target_type = 'intercession'
  left join public.profiles ia on ia.id = i.intercessor_id
  where r.status = p_status
    and (((p_before is null and p_before_id is null) or (r.created_at, r.id) < (p_before, p_before_id)))
  order by r.created_at desc, r.id desc
  limit greatest(least(p_limit, 50), 1);
end;
$$;


--
-- Name: reserve_generation(uuid, text, smallint, uuid, text, jsonb, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reserve_generation(p_request_id uuid, p_scope text, p_duration_days smallint, p_group_id uuid DEFAULT NULL::uuid, p_visibility text DEFAULT 'private'::text, p_source_prompt jsonb DEFAULT NULL::jsonb, p_circle_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(ok boolean, reason text, plan_id uuid, reservation_id uuid, quota_used integer, quota_limit integer, created boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid := (select auth.uid());
  v_limit constant integer := 3;
  v_used integer;
  v_existing public.generation_ledger;
  v_plan public.prayer_plans;
  v_reservation_id uuid;
  v_visibility public.plan_visibility;
  v_circle uuid;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_scope not in ('personal', 'circle') then
    raise exception 'reserve_generation: unknown scope %', p_scope;
  end if;

  -- Serializa las reservas de ESTE usuario ANTES de mirar nada: así la
  -- idempotencia y el conteo de cuota no pueden correr.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  -- Idempotencia DENTRO del lock y acotada al dueño: un caller nunca lee el
  -- plan ajeno adivinando un request_id.
  select * into v_existing
    from public.generation_ledger
   where request_id = p_request_id
     and user_id = v_user
     and scope in ('personal', 'circle');
  if found then
    select count(*) into v_used
      from public.generation_ledger
     where user_id = v_user
       and scope in ('personal', 'circle');

    return query
      select true, 'ok', v_existing.plan_id, v_existing.id, v_used, v_limit, false;
    return;
  end if;

  -- Un request_id que YA usó otro usuario: rechazo limpio, no un UNIQUE
  -- violation convertido en 500.
  if exists (
    select 1 from public.generation_ledger where request_id = p_request_id
  ) then
    return query
      select false, 'request_id_conflict', null::uuid, null::uuid, 0, v_limit, false;
    return;
  end if;

  -- Revalidación server-side de la duración: nunca se fía del cliente.
  if p_duration_days < 3 or p_duration_days > 30 then
    return query
      select false, 'invalid_duration', null::uuid, null::uuid, 0, v_limit, false;
    return;
  end if;

  -- Un plan de círculo: el dueño debe administrarlo y no puede haber ya un
  -- plan activo en él.
  if p_scope = 'circle' then
    if p_group_id is null or not public.can_create_circle_plan(p_group_id) then
      return query
        select false, 'circle_not_allowed', null::uuid, null::uuid, 0, v_limit, false;
      return;
    end if;
    v_visibility := 'group'::public.plan_visibility;
  else
    v_visibility := case p_visibility
      when 'link' then 'link'::public.plan_visibility
      when 'public' then 'public'::public.plan_visibility
      else 'private'::public.plan_visibility
    end;
  end if;

  -- Validar los círculos a compartir ANTES de gastar cuota: un id inválido
  -- revierte la reserva entera (sin plan, sin fila de ledger).
  if p_scope = 'personal' and p_circle_ids is not null then
    foreach v_circle in array p_circle_ids loop
      if v_circle is null or not public.is_group_member(v_circle) then
        return query
          select false, 'invalid_circles', null::uuid, null::uuid, 0, v_limit, false;
        return;
      end if;
    end loop;
  end if;

  select count(*) into v_used
    from public.generation_ledger
   where user_id = v_user
     and scope in ('personal', 'circle');

  if v_used >= v_limit then
    return query
      select false, 'quota_exhausted', null::uuid, null::uuid, v_used, v_limit, false;
    return;
  end if;

  -- Plan + reserva + shares nacen en la MISMA transacción: no hay ventana entre
  -- "consumí la cuota" y "existe el plan", ni entre "existe el plan" y "está
  -- compartido con los círculos elegidos".
  insert into public.prayer_plans (
    owner_id, title, duration_days, start_date, visibility, group_id,
    status, generated_by, source_prompt
  )
  values (
    v_user, '…', p_duration_days, public.local_today(v_user), v_visibility,
    case when p_scope = 'circle' then p_group_id else null end,
    'generating', 'ai', p_source_prompt
  )
  returning * into v_plan;

  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, group_id, duration_days, status
  )
  values (
    p_request_id, v_user, p_scope, v_plan.id,
    case when p_scope = 'circle' then p_group_id else null end,
    p_duration_days, 'reserved'
  )
  returning id into v_reservation_id;

  if p_scope = 'personal' and p_circle_ids is not null then
    insert into public.plan_shares (plan_id, group_id, created_by)
    select v_plan.id, c, v_user from unnest(p_circle_ids) c;
  end if;

  return query
    select true, 'ok', v_plan.id, v_reservation_id, v_used + 1, v_limit, true;
end;
$$;


--
-- Name: resolve_push_notification(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_push_notification(p_outbox_id uuid) RETURNS TABLE(authorized boolean, intercessor_name text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner_id uuid;
  v_intercessor_id uuid;
  v_intercessor_name text;
begin
  select i.plan_owner_id, i.intercessor_id, pr.display_name
    into v_owner_id, v_intercessor_id, v_intercessor_name
  from public.push_outbox o
  join public.intercessions i on i.id = o.intercession_id
  join public.profiles pr on pr.id = i.intercessor_id
  where o.id = p_outbox_id;

  -- La fila no existe, o quien pregunta no es el dueño al que iba dirigida:
  -- nunca se distingue el motivo en la respuesta — ambos casos devuelven
  -- exactamente lo mismo, así que un cliente comprometido no puede usar esto
  -- para sondear ids de outbox ajenos.
  if v_owner_id is null or v_owner_id <> (select auth.uid()) then
    return query select false, null::text;
    return;
  end if;

  -- El bloqueo puede haber ocurrido después de que el push saliera: abrir el
  -- aviso no puede seguir siendo un camino de vuelta hacia alguien a quien
  -- ya se decidió bloquear.
  if exists (
    select 1 from public.blocks b
    where b.blocker_id = v_owner_id and b.blocked_id = v_intercessor_id
  ) then
    return query select false, null::text;
    return;
  end if;

  return query select true, v_intercessor_name;
end;
$$;


--
-- Name: resolve_report(uuid, public.report_status); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_report(p_report_id uuid, p_status public.report_status) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.is_staff() then
    return false;
  end if;

  if p_status = 'open' then
    raise exception 'a report is closed as reviewed or dismissed, not reopened';
  end if;

  update public.reports
     set status = p_status
   where id = p_report_id;

  -- `found` en vez de devolver true a secas: cerrar un id que no existe tiene
  -- que poder distinguirse de cerrarlo de verdad.
  return found;
end;
$$;


--
-- Name: resolve_scripture(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_scripture(p_ref text) RETURNS TABLE(canonical_ref text, book_id smallint, chapter smallint, verse_start smallint, verse_end smallint, text text)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $_$
declare
  parts text[];
  resolved_book smallint;
  book_label text;
  ch smallint;
  v_start smallint;
  v_end smallint;
  body text;
begin
  -- book / chapter : verse [- verse]
  parts := regexp_match(
    coalesce(p_ref, ''),
    '^\s*(.+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*$'
  );

  if parts is null then
    return;
  end if;

  select a.book_id into resolved_book
  from public.bible_book_aliases a
  where a.alias = public.normalize_book_name(parts[1]);

  -- Enumerating every abbreviation a model might invent ("Prov.", "Filip.",
  -- "Apoc.") is a losing game, so fall back to a prefix match. It must resolve
  -- to exactly one book: "1 C" is ambiguous between Corintios and Crónicas and
  -- has to fail rather than guess.
  if resolved_book is null then
    select case when count(*) = 1 then min(candidates.book_id) end
      into resolved_book
    from (
      select distinct a.book_id
      from public.bible_book_aliases a
      where char_length(public.normalize_book_name(parts[1])) >= 3
        and a.alias like public.normalize_book_name(parts[1]) || '%'
    ) as candidates;
  end if;

  if resolved_book is null then
    return;
  end if;

  ch := parts[2]::smallint;
  v_start := parts[3]::smallint;
  v_end := coalesce(parts[4]::smallint, v_start);

  if v_end < v_start then
    return;
  end if;

  -- A whole chapter is not a devotional reading; keep passages short.
  if v_end - v_start > 9 then
    v_end := (v_start + 9)::smallint;
  end if;

  select string_agg(bv.text, ' ' order by bv.verse)
    into body
  from public.bible_verses bv
  where bv.book_id = resolved_book
    and bv.chapter = ch
    and bv.verse between v_start and v_end;

  if body is null then
    return;
  end if;

  select b.modern_name into book_label
  from public.bible_books b
  where b.id = resolved_book;

  canonical_ref := book_label || ' ' || ch || ':' || v_start
    || case when v_end > v_start then '-' || v_end else '' end;

  book_id := resolved_book;
  chapter := ch;
  verse_start := v_start;
  verse_end := v_end;
  text := body;

  return next;
end;
$_$;


--
-- Name: revoke_all_my_push_devices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_all_my_push_devices() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_count integer;
begin
  update public.push_devices
     set revoked_at = now()
   where user_id = (select auth.uid())
     and revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


--
-- Name: revoke_push_device(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_push_device(p_token text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  update public.push_devices
     set revoked_at = now()
   where expo_push_token = p_token
     and user_id = (select auth.uid())
     and revoked_at is null;

  return found;
end;
$$;


--
-- Name: search_bible(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_bible(p_query text, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0) RETURNS TABLE(book_id smallint, book_name text, chapter smallint, verse smallint, text text, total_count bigint)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    v.book_id,
    b.modern_name,
    v.chapter,
    v.verse,
    v.text,
    count(*) over ()
  from public.bible_verses v
  join public.bible_books b on b.id = v.book_id
  where v.search_vector @@ websearch_to_tsquery(
          'spanish'::regconfig,
          public.immutable_unaccent(coalesce(p_query, ''))
        )
  order by v.book_id, v.chapter, v.verse
  limit greatest(least(p_limit, 100), 1)
  offset greatest(p_offset, 0);
$$;


--
-- Name: search_people(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_people(p_query text DEFAULT ''::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, display_name text, avatar_url text, follower_count integer, i_follow boolean, total_count bigint)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  v_terms text;
  v_query tsquery;
begin
  -- Fail-closed igual que home_feed: OFF es directorio vacío, antes de leer
  -- nada. El saneado de la consulta y el orden no cambian respecto de
  -- `20260810100200_community.sql`.
  if not public.flag_enabled('community_feed') then
    return;
  end if;

  v_terms := btrim(
    regexp_replace(coalesce(p_query, ''), '[^[:alnum:][:space:]]', ' ', 'g')
  );

  if v_terms <> '' then
    v_query := to_tsquery(
      'spanish'::regconfig,
      array_to_string(
        array(
          select public.immutable_unaccent(w) || ':*'
          from unnest(regexp_split_to_array(v_terms, '\s+')) as w
          where w <> ''
        ),
        ' & '
      )
    );

    if numnode(v_query) = 0 then
      v_query := null;
    end if;
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.follower_count,
    exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.followee_id = p.id
    ),
    count(*) over ()
  from public.profiles p
  where p.id <> (select auth.uid())
    and not public.has_blocked(p.id)
    and (v_query is null or p.search_vector @@ v_query)
    and btrim(p.display_name) <> ''
  order by p.follower_count desc, p.display_name
  limit greatest(least(p_limit, 50), 1)
  offset greatest(p_offset, 0);
end;
$$;


--
-- Name: search_public_circles(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_public_circles(p_query text DEFAULT ''::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, name text, description text, member_count integer, is_member boolean, total_count bigint)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  v_terms text;
  v_query tsquery;
begin
  -- La consulta pasa por el mismo filtro que el índice, o "manana" buscaría
  -- 'manan' contra un vector que guarda 'manan' solo si también se limpió.
  v_terms := btrim(
    regexp_replace(
      public.immutable_unaccent(coalesce(p_query, '')),
      '[^[:alnum:][:space:]]', ' ', 'g'
    )
  );

  if v_terms <> '' then
    v_query := to_tsquery(
      'spanish'::regconfig,
      array_to_string(
        array(
          select w || ':*'
          from unnest(regexp_split_to_array(v_terms, '\s+')) as w
          where w <> ''
        ),
        ' & '
      )
    );

    if numnode(v_query) = 0 then
      v_query := null;
    end if;
  end if;

  return query
  select
    g.id,
    g.name,
    g.description,
    g.member_count,
    exists (
      select 1 from public.group_members m
      where m.group_id = g.id and m.user_id = (select auth.uid())
    ),
    count(*) over ()
  from public.groups g
  where g.visibility = 'public'
    and (v_query is null or g.search_vector @@ v_query)
  order by g.member_count desc, g.name
  limit greatest(least(p_limit, 50), 1)
  offset greatest(p_offset, 0);
end;
$$;


--
-- Name: set_intercession_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_intercession_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  select p.owner_id into new.plan_owner_id
  from public.prayer_plan_days d
  join public.prayer_plans p on p.id = d.plan_id
  where d.id = new.plan_day_id;

  if new.plan_owner_id is null then
    raise exception 'unknown plan day %', new.plan_day_id;
  end if;

  return new;
end;
$$;


--
-- Name: set_share_link_expiry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_share_link_expiry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  plan_end date;
begin
  if new.expires_at is not null then
    return new;
  end if;

  if new.scope = 'plan' then
    select p.start_date + p.duration_days
      into plan_end
    from public.prayer_plans p
    where p.id = new.plan_id;

    -- A month past the last day: long enough for someone to come back to a
    -- finished plan, short enough that it does not linger indefinitely.
    new.expires_at := coalesce(plan_end, current_date + 30) + interval '30 days';
  else
    -- A circle invite is not a personal request and gets a longer life, but
    -- still not an unlimited one.
    new.expires_at := now() + interval '90 days';
  end if;

  return new;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: settle_generation_chunk(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_generation_chunk(p_lease_id uuid, p_outcome text, p_error text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_user uuid := (select auth.uid());
  v_plan_id uuid;
  v_lease public.plan_generation_leases;
  v_duration smallint;
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if p_outcome not in ('completed', 'failed') then
    raise exception 'settle_generation_chunk: unknown outcome %', p_outcome;
  end if;

  select plan_id into v_plan_id
    from public.plan_generation_leases
   where lease_id = p_lease_id;
  if not found then
    return false;
  end if;

  -- Mismo advisory lock que claim/complete.
  perform pg_advisory_xact_lock(hashtextextended(v_plan_id::text, 0));

  -- Re-leer bajo lock: si el lease ya no es el mismo (reclaim) o venció → no-op.
  select * into v_lease
    from public.plan_generation_leases
   where plan_id = v_plan_id
     and lease_id = p_lease_id
     and leased_until > now();
  if not found then
    return false;
  end if;

  if v_lease.claimed_by <> v_user then
    raise exception 'settle_generation_chunk: not the lease holder';
  end if;

  select p.duration_days into v_duration
    from public.prayer_plans p
   where p.id = v_lease.plan_id;

  insert into public.generation_ledger (
    request_id, user_id, scope, plan_id, duration_days,
    from_day, to_day, status, error
  )
  values (
    v_lease.request_id, v_user, 'continuation', v_lease.plan_id, v_duration,
    v_lease.from_day, v_lease.to_day,
    case when p_outcome = 'completed' then 'completed' else 'failed' end,
    p_error
  );

  -- Borrar exactamente UNA fila por lease_id; si ya fue reclamada, 0 filas
  -- borradas — no es fallo, pero tampoco se hace doble ledger.
  delete from public.plan_generation_leases where lease_id = p_lease_id;
  get diagnostics v_deleted = row_count;

  return true;
end;
$$;


--
-- Name: shares_a_circle_with(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shares_a_circle_with(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user
  );
$$;


--
-- Name: sync_follow_counts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_follow_counts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
       set follower_count = follower_count + 1
     where id = new.followee_id;

    update public.profiles
       set following_count = following_count + 1
     where id = new.follower_id;

    return new;
  else
    update public.profiles
       set follower_count = greatest(follower_count - 1, 0)
     where id = old.followee_id;

    update public.profiles
       set following_count = greatest(following_count - 1, 0)
     where id = old.follower_id;

    return old;
  end if;
end;
$$;


--
-- Name: sync_group_member_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_group_member_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.groups
       set member_count = member_count + 1
     where id = new.group_id;
    return new;
  else
    update public.groups
       set member_count = greatest(member_count - 1, 0)
     where id = old.group_id;
    return old;
  end if;
end;
$$;


--
-- Name: sync_intercession_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_intercession_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    update public.prayer_plan_days
       set intercession_count = intercession_count + 1
     where id = new.plan_day_id;
    return new;
  else
    update public.prayer_plan_days
       set intercession_count = greatest(intercession_count - 1, 0)
     where id = old.plan_day_id;
    return old;
  end if;
end;
$$;


--
-- Name: sync_post_counters(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_post_counters() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  target uuid := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
begin
  if tg_table_name = 'post_prayers' then
    update public.posts
       set prayer_count = greatest(prayer_count + delta, 0)
     where id = target;
  else
    update public.posts
       set comment_count = greatest(comment_count + delta, 0)
     where id = target;
  end if;

  return case when tg_op = 'INSERT' then new else old end;
end;
$$;


--
-- Name: valid_timezone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valid_timezone(tz text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case
    when tz is null or btrim(tz) = '' then 'UTC'
    when exists (select 1 from pg_catalog.pg_timezone_names n where n.name = btrim(tz))
      then btrim(tz)
    else 'UTC'
  end;
$$;


--
-- Name: validate_active_plan(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_active_plan() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.active_plan_id is not null then
    if not exists (
      select 1 from public.prayer_plans p
      where p.id = new.active_plan_id and p.owner_id = new.id
    ) then
      raise exception 'active_plan_id must be a plan you own';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: validate_avatar_url(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_avatar_url() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.avatar_url is null or new.avatar_url = '' then
    return new;
  end if;

  if new.avatar_url not like '%/storage/v1/object/public/avatars/' || new.id::text || '/%' then
    raise exception 'avatar_url must point at your own folder in the avatars bucket';
  end if;

  return new;
end;
$$;


--
-- Name: verse_of_the_day(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verse_of_the_day() RETURNS TABLE(book_id smallint, book_name text, chapter smallint, verse smallint, reference text, text text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with today as (
    select public.local_today((select auth.uid())) as day
  ),
  pick as (
    select d.*
    from public.daily_verses d, today t
    -- `mod` sobre los días desde una fecha fija: recorre la lista entera antes
    -- de repetir, en vez de un `random()` que puede dar el mismo dos días
    -- seguidos.
    where d.ord = 1 + (
      ((select t.day from today t) - date '2026-01-01')
      % (select count(*) from public.daily_verses)
    )
  )
  select
    p.book_id,
    b.modern_name,
    p.chapter,
    p.verse,
    b.modern_name || ' ' || p.chapter || ':' || p.verse,
    v.text
  from pick p
  join public.bible_books b on b.id = p.book_id
  join public.bible_verses v
    on v.book_id = p.book_id and v.chapter = p.chapter and v.verse = p.verse;
$$;


--
-- Name: visible_testimonies(timestamp with time zone, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.visible_testimonies(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30) RETURNS TABLE(id uuid, body text, visibility text, created_at timestamp with time zone, author_id uuid, author_name text, author_avatar_url text, plan_title text, is_mine boolean)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    t.id,
    t.body,
    t.visibility::text,
    t.created_at,
    t.user_id,
    pr.display_name,
    pr.avatar_url,
    p.title,
    t.user_id = (select auth.uid())
  from public.testimonies t
  join public.profiles pr on pr.id = t.user_id
  left join public.prayer_plans p on p.id = t.plan_id
  where p_before is null or t.created_at < p_before
  order by t.created_at desc
  limit greatest(least(p_limit, 100), 1);
$$;


--
-- Name: visible_testimonies_page(timestamp with time zone, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.visible_testimonies_page(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30, p_before_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, body text, visibility text, created_at timestamp with time zone, author_id uuid, author_name text, author_avatar_url text, plan_title text, is_mine boolean)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select
    t.id,
    t.body,
    t.visibility::text,
    t.created_at,
    t.user_id,
    pr.display_name,
    pr.avatar_url,
    p.title,
    t.user_id = (select auth.uid())
  from public.testimonies t
  join public.profiles pr on pr.id = t.user_id
  left join public.prayer_plans p on p.id = t.plan_id
  where ((p_before is null and p_before_id is null) or (t.created_at, t.id) < (p_before, p_before_id))
  order by t.created_at desc, t.id desc
  limit greatest(least(p_limit, 100), 1);
$$;


--
-- Name: who_prayed_for_me(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.who_prayed_for_me(p_since date DEFAULT NULL::date) RETURNS TABLE(intercession_id uuid, intercessor_id uuid, intercessor_name text, intercessor_avatar_url text, message text, day_number smallint, created_at timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  with viewer as (
    select public.valid_timezone(ps.timezone) as tz
    from public.profile_settings ps
    where ps.id = (select auth.uid())
  )
  select
    i.id,
    i.intercessor_id,
    pr.display_name,
    pr.avatar_url,
    case when i.message_hidden_at is null then i.message end,
    d.day_number,
    i.created_at
  from public.intercessions i
  cross join viewer v
  join public.profiles pr on pr.id = i.intercessor_id
  join public.prayer_plan_days d on d.id = i.plan_day_id
  where i.plan_owner_id = (select auth.uid())
    and not public.has_blocked(i.intercessor_id)
    and (i.created_at at time zone v.tz)::date
        >= coalesce(p_since, (now() at time zone v.tz)::date)
  order by i.created_at desc;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
    -- Regclass of the table e.g. public.notes
    entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

    -- I, U, D, T: insert, update ...
    action realtime.action = (
        case wal ->> 'action'
            when 'I' then 'INSERT'
            when 'U' then 'UPDATE'
            when 'D' then 'DELETE'
            else 'ERROR'
        end
    );

    -- Is row level security enabled for the table
    is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

    subscriptions realtime.subscription[] = array_agg(subs)
        from
            realtime.subscription subs
        where
            subs.entity = entity_
            -- Filter by action early - only get subscriptions interested in this action
            -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
            and (subs.action_filter = '*' or subs.action_filter = action::text);

    -- Subscription vars
    working_role regrole;
    working_selected_columns text[];
    claimed_role regrole;
    claims jsonb;

    subscription_id uuid;
    subscription_has_access bool;
    visible_to_subscription_ids uuid[] = '{}';

    -- structured info for wal's columns
    columns realtime.wal_column[];
    -- previous identity values for update/delete
    old_columns realtime.wal_column[];

    error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

    -- Primary jsonb output for record
    output jsonb;

    -- Loop record for iterating unique roles (outer loop)
    role_record record;
    -- Loop record for iterating unique selected_columns within a role (inner loop)
    cols_record record;
    -- Subscription ids visible at the role level (before fanning out by selected_columns)
    visible_role_sub_ids uuid[] = '{}';

begin
    perform set_config('role', null, true);

    columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'columns') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    old_columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'identity') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    for role_record in
        select claims_role
        from (select distinct claims_role from unnest(subscriptions)) t
        order by claims_role::text
    loop
        working_role := role_record.claims_role;

        -- Update `is_selectable` for columns and old_columns (once per role)
        columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(columns) c;

        old_columns =
                array_agg(
                    (
                        c.name,
                        c.type_name,
                        c.type_oid,
                        c.value,
                        c.is_pkey,
                        pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                    )::realtime.wal_column
                )
                from
                    unnest(old_columns) c;

        if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
            -- Fan out 400 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 400: Bad Request, no primary key']
                )::realtime.wal_rls;
            end loop;

        -- The claims role does not have SELECT permission to the primary key of entity
        elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
            -- Fan out 401 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 401: Unauthorized']
                )::realtime.wal_rls;
            end loop;

        else
            -- Create the prepared statement (once per role)
            if is_rls_enabled and action <> 'DELETE' then
                if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                    deallocate walrus_rls_stmt;
                end if;
                execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
            end if;

            -- Collect all visible subscription IDs for this role (filter check + RLS check)
            visible_role_sub_ids = '{}';

            for subscription_id, claims in (
                    select
                        subs.subscription_id,
                        subs.claims
                    from
                        unnest(subscriptions) subs
                    where
                        subs.entity = entity_
                        and subs.claims_role = working_role
                        and (
                            realtime.is_visible_through_filters(columns, subs.filters)
                            or (
                              action = 'DELETE'
                              and realtime.is_visible_through_filters(old_columns, subs.filters)
                            )
                        )
            ) loop

                if not is_rls_enabled or action = 'DELETE' then
                    visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                else
                    -- Check if RLS allows the role to see the record
                    perform
                        -- Trim leading and trailing quotes from working_role because set_config
                        -- doesn't recognize the role as valid if they are included
                        set_config('role', trim(both '"' from working_role::text), true),
                        set_config('request.jwt.claims', claims::text, true);

                    execute 'execute walrus_rls_stmt' into subscription_has_access;

                    -- Reset the role on every FOR..LOOP batch execution.
                    -- The first batch of 10 rows is pre-fetched using the current connection role (PG internal behaviour)
                    -- then we have to reset it again otherwise it would use the role defined in the `set_config` above
                    -- to fetch the remaining rows when rows>10, which could be a user-defined role that lacks execution grants.
                    -- The flow is:
                    --   1. run batch with conn role
                    --   2. set_config working_role
                    --   3. execute walrus
                    --   4. reset role (revert)
                    --   5. repeat
                    perform set_config('role', null, true);

                    if subscription_has_access then
                        visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                    end if;
                end if;
            end loop;

            perform set_config('role', null, true);

            -- Inner loop: per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;

                output = jsonb_build_object(
                    'schema', wal ->> 'schema',
                    'table', wal ->> 'table',
                    'type', action,
                    'commit_timestamp', to_char(
                        ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ),
                    'columns', (
                        select
                            jsonb_agg(
                                jsonb_build_object(
                                    'name', pa.attname,
                                    'type', pt.typname
                                )
                                order by pa.attnum asc
                            )
                        from
                            pg_attribute pa
                            join pg_type pt
                                on pa.atttypid = pt.oid
                            left join (
                                select unnest(conkey) as pkey_attnum
                                from pg_constraint
                                where conrelid = entity_ and contype = 'p'
                            ) pk on pk.pkey_attnum = pa.attnum
                        where
                            attrelid = entity_
                            and attnum > 0
                            and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
                            and (working_selected_columns is null or pa.attname = any(working_selected_columns) or pk.pkey_attnum is not null)
                    )
                )
                -- Add "record" key for insert and update
                || case
                    when action in ('INSERT', 'UPDATE') then
                        jsonb_build_object(
                            'record',
                            (
                                select
                                    jsonb_object_agg(
                                        -- if unchanged toast, get column name and value from old record
                                        coalesce((c).name, (oc).name),
                                        case
                                            when (c).name is null then (oc).value
                                            else (c).value
                                        end
                                    )
                                from
                                    unnest(columns) c
                                    full outer join unnest(old_columns) oc
                                        on (c).name = (oc).name
                                where
                                    coalesce((c).is_selectable, (oc).is_selectable)
                                    and (working_selected_columns is null or coalesce((c).name, (oc).name) = any(working_selected_columns) or coalesce((c).is_pkey, (oc).is_pkey))
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            )
                        )
                    else '{}'::jsonb
                end
                -- Add "old_record" key for update and delete
                || case
                    when action = 'UPDATE' then
                        jsonb_build_object(
                                'old_record',
                                (
                                    select jsonb_object_agg((c).name, (c).value)
                                    from unnest(old_columns) c
                                    where
                                        (c).is_selectable
                                        and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                        and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                )
                            )
                    when action = 'DELETE' then
                        jsonb_build_object(
                            'old_record',
                            (
                                select jsonb_object_agg((c).name, (c).value)
                                from unnest(old_columns) c
                                where
                                    (c).is_selectable
                                    and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                    and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                            )
                        )
                    else '{}'::jsonb
                end;

                -- Filter visible_role_sub_ids to those matching the current selected_columns group
                visible_to_subscription_ids = coalesce(
                    (
                        select array_agg(s.subscription_id)
                        from unnest(subscriptions) s
                        where s.claims_role = working_role
                          and (s.selected_columns is not distinct from working_selected_columns)
                          and s.subscription_id = any(visible_role_sub_ids)
                    ),
                    '{}'::uuid[]
                );

                return next (
                    output,
                    is_rls_enabled,
                    visible_to_subscription_ids,
                    case
                        when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                        else '{}'
                    end
                )::realtime.wal_rls;
            end loop;

        end if;
    end loop;

    perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
/*
Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
*/
declare
    op_symbol text = (
        case
            when op = 'eq' then '='
            when op = 'neq' then '!='
            when op = 'lt' then '<'
            when op = 'lte' then '<='
            when op = 'gt' then '>'
            when op = 'gte' then '>='
            when op = 'in' then '= any'
            else 'UNKNOWN OP'
        end
    );
    res boolean;
begin
    execute format(
        'select %L::'|| type_::text || ' ' || op_symbol
        || ' ( %L::'
        || (
            case
                when op = 'in' then type_::text || '[]'
                else type_::text end
        )
        || ')', val_1, val_2) into res;
    return res;
end;
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
declare
    op_symbol text;
    res boolean;
begin
    -- IS DISTINCT FROM / IS NOT DISTINCT FROM: infix, both sides typed literals
    if op = 'isdistinct' then
        execute format(
            'select %L::%s %s %L::%s',
            val_1,
            type_::text,
            case when negate then 'IS NOT DISTINCT FROM' else 'IS DISTINCT FROM' end,
            val_2,
            type_::text
        ) into res;
        return res;
    end if;

    -- IS requires a keyword RHS (NULL, TRUE, FALSE, UNKNOWN), not a typed literal
    if op = 'is' then
        if val_2 not in ('null', 'true', 'false', 'unknown') then
            raise exception 'invalid value for is filter: must be null, true, false, or unknown';
        end if;
        execute format(
            'select %L::%s %s %s',
            val_1,
            type_::text,
            case when negate then 'IS NOT' else 'IS' end,
            upper(val_2)
        ) into res;
        return res;
    end if;

    op_symbol = case
        when op = 'eq'    then '='
        when op = 'neq'   then '!='
        when op = 'lt'    then '<'
        when op = 'lte'   then '<='
        when op = 'gt'    then '>'
        when op = 'gte'   then '>='
        when op = 'in'    then '= any'
        when op = 'like'   then 'LIKE'
        when op = 'ilike'  then 'ILIKE'
        when op = 'match'  then '~'
        when op = 'imatch' then '~*'
        else null
    end;

    if op_symbol is null then
        raise exception 'unsupported equality operator: %', op::text;
    end if;

    execute format(
        'select %L::%s %s (%L::%s)',
        val_1,
        type_::text,
        op_symbol,
        val_2,
        case when op = 'in' then type_::text || '[]' else type_::text end
    ) into res;

    return case when negate then not res else res end;
end;
$$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select
        filters is null
        or array_length(filters, 1) is null
        or coalesce(
            count(col.name) = count(1)
            and sum(
                realtime.check_equality_op(
                    op:=f.op,
                    type_:=coalesce(col.type_oid::regtype, col.type_name::regtype),
                    val_1:=col.value #>> '{}',
                    val_2:=f.value,
                    negate:=coalesce(f.negate, false)
                )::int
            ) filter (where col.name is not null) = count(col.name),
            false
        )
    from
        unnest(filters) f
        left join unnest(columns) col
            on f.column_name = col.name;
$$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  SELECT
    realtime.wal2json_escape_identifier(nsp.nspname::text)
    || '.'
    || realtime.wal2json_escape_identifier(pc.relname::text)
  FROM pg_class pc
  JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
  WHERE pc.oid = entity
$$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: send_binary(bytea, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, binary_payload, event, topic, private, extension)
    VALUES (generated_id, payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
    col_names text[] = coalesce(
            array_agg(a.attname order by a.attnum),
            '{}'::text[]
        )
        from
            pg_catalog.pg_attribute a
        where
            a.attrelid = new.entity
            and a.attnum > 0
            and not a.attisdropped
            and pg_catalog.has_column_privilege(
                (new.claims ->> 'role'),
                a.attrelid,
                a.attnum,
                'SELECT'
            );
    filter realtime.user_defined_filter;
    col_type regtype;
    in_val jsonb;
    selected_col text;
begin
    for filter in select * from unnest(new.filters) loop
        if not filter.column_name = any(col_names) then
            raise exception 'invalid column for filter %', filter.column_name;
        end if;

        col_type = (
            select atttypid::regtype
            from pg_catalog.pg_attribute
            where attrelid = new.entity
                  and attname = filter.column_name
        );
        if col_type is null then
            raise exception 'failed to lookup type for column %', filter.column_name;
        end if;

        if filter.op = 'in'::realtime.equality_op then
            in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
            if coalesce(jsonb_array_length(in_val), 0) > 100 then
                raise exception 'too many values for `in` filter. Maximum 100';
            end if;
        elsif filter.op = 'is'::realtime.equality_op then
            -- `is` requires a keyword RHS rather than a typed literal
            if filter.value not in ('null', 'true', 'false', 'unknown') then
                raise exception 'invalid value for is filter: must be null, true, false, or unknown';
            end if;
            -- IS NULL works for any type, but IS TRUE/FALSE/UNKNOWN require a boolean
            -- operand. Reject the non-null keywords on non-boolean columns here so they
            -- don't abort apply_rls at WAL time.
            if filter.value <> 'null' and col_type <> 'boolean'::regtype then
                raise exception 'is % filter requires a boolean column, got %', filter.value, col_type::text;
            end if;
        elsif filter.op in ('like'::realtime.equality_op, 'ilike'::realtime.equality_op) then
            -- like/ilike apply the text pattern operator (~~); reject column types that
            -- have no such operator instead of failing at WAL time
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = '~~' and oprleft = col_type
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
        elsif filter.op in ('match'::realtime.equality_op, 'imatch'::realtime.equality_op) then
            -- match/imatch apply the regex operators ~ / ~*; reject column types that have
            -- no such operator (e.g. integer) instead of failing at WAL time, mirroring the
            -- like/ilike guard above.
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = case when filter.op = 'imatch'::realtime.equality_op then '~*' else '~' end
                  and oprleft = col_type
                  and oprright = col_type
                  and oprresult = 'boolean'::regtype
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
            -- validate the regex eagerly so a bad pattern is rejected here, not inside
            -- apply_rls where it would abort the WAL stream for the entity
            begin
                perform '' ~ filter.value;
            exception when others then
                raise exception 'invalid regular expression for % filter: %', filter.op::text, sqlerrm;
            end;
        else
            -- eq/neq/lt/lte/gt/gte: value must be coercable to the type
            perform realtime.cast(filter.value, col_type);
        end if;
    end loop;

    if new.selected_columns is not null then
        for selected_col in select * from unnest(new.selected_columns) loop
            if not selected_col = any(col_names) then
                raise exception 'invalid column for select %', selected_col;
            end if;
        end loop;
    end if;

    -- Apply consistent order to filters so the unique constraint can't be tricked by a
    -- different filter order. negate is part of the sort key.
    new.filters = coalesce(
        array_agg(f order by f.column_name, f.op, f.value, f.negate),
        '{}'
    ) from unnest(new.filters) f;

    new.selected_columns = (
        select array_agg(c order by c)
        from unnest(new.selected_columns) c
    );

    return new;
end;
$$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: wal2json_escape_identifier(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.wal2json_escape_identifier(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  -- Prefix `\`, `,`, `.`, and any whitespace with `\`
  SELECT regexp_replace(name, '([\\,.[:space:]])', '\\\1', 'g')
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: http_request(); Type: FUNCTION; Schema: supabase_functions; Owner: -
--

CREATE FUNCTION supabase_functions.http_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'supabase_functions'
    AS $$
  DECLARE
    request_id bigint;
    payload jsonb;
    url text := TG_ARGV[0]::text;
    method text := TG_ARGV[1]::text;
    headers jsonb DEFAULT '{}'::jsonb;
    params jsonb DEFAULT '{}'::jsonb;
    timeout_ms integer DEFAULT 1000;
  BEGIN
    IF url IS NULL OR url = 'null' THEN
      RAISE EXCEPTION 'url argument is missing';
    END IF;

    IF method IS NULL OR method = 'null' THEN
      RAISE EXCEPTION 'method argument is missing';
    END IF;

    IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
      headers = '{"Content-Type": "application/json"}'::jsonb;
    ELSE
      headers = TG_ARGV[2]::jsonb;
    END IF;

    IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
      params = '{}'::jsonb;
    ELSE
      params = TG_ARGV[3]::jsonb;
    END IF;

    IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
      timeout_ms = 1000;
    ELSE
      timeout_ms = TG_ARGV[4]::integer;
    END IF;

    CASE
      WHEN method = 'GET' THEN
        SELECT http_get INTO request_id FROM net.http_get(
          url,
          params,
          headers,
          timeout_ms
        );
      WHEN method = 'POST' THEN
        payload = jsonb_build_object(
          'old_record', OLD,
          'record', NEW,
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'schema', TG_TABLE_SCHEMA
        );

        SELECT http_post INTO request_id FROM net.http_post(
          url,
          payload,
          params,
          headers,
          timeout_ms
        );
      ELSE
        RAISE EXCEPTION 'method argument % is invalid', method;
    END CASE;

    INSERT INTO supabase_functions.hooks
      (hook_table_id, hook_name, request_id)
    VALUES
      (TG_RELID, TG_NAME, request_id);

    RETURN NEW;
  END
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: extensions; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.extensions (
    id uuid NOT NULL,
    type text,
    settings jsonb,
    tenant_external_id text,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: feature_flags; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.feature_flags (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    rollout_percentage integer DEFAULT 100 NOT NULL,
    bucket_key character varying(255),
    CONSTRAINT rollout_percentage_must_be_between_0_and_100 CHECK (((rollout_percentage >= 0) AND (rollout_percentage <= 100)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: tenants; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.tenants (
    id uuid NOT NULL,
    name text,
    external_id text,
    jwt_secret text,
    max_concurrent_users integer DEFAULT 200 NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    max_events_per_second integer DEFAULT 100 NOT NULL,
    postgres_cdc_default text DEFAULT 'postgres_cdc_rls'::text,
    max_bytes_per_second integer DEFAULT 100000 NOT NULL,
    max_channels_per_client integer DEFAULT 100 NOT NULL,
    max_joins_per_second integer DEFAULT 500 NOT NULL,
    suspend boolean DEFAULT false,
    jwt_jwks jsonb,
    notify_private_alpha boolean DEFAULT false,
    private_only boolean DEFAULT false NOT NULL,
    migrations_ran integer DEFAULT 0,
    broadcast_adapter character varying(255) DEFAULT 'gen_rpc'::character varying,
    max_presence_events_per_second integer DEFAULT 1000,
    max_payload_size_in_kb integer DEFAULT 3000,
    max_client_presence_events_per_window integer,
    client_presence_window_ms integer,
    presence_enabled boolean DEFAULT false NOT NULL,
    feature_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT jwt_secret_or_jwt_jwks_required CHECK (((jwt_secret IS NOT NULL) OR (jwt_jwks IS NOT NULL)))
);


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: bible_book_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bible_book_aliases (
    alias text NOT NULL,
    book_id smallint NOT NULL
);


--
-- Name: bible_books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bible_books (
    id smallint NOT NULL,
    name text NOT NULL,
    modern_name text NOT NULL,
    new_testament boolean NOT NULL,
    chapter_count smallint NOT NULL,
    CONSTRAINT bible_books_chapter_count_positive CHECK ((chapter_count > 0))
);


--
-- Name: bible_highlights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bible_highlights (
    user_id uuid NOT NULL,
    book_id smallint NOT NULL,
    chapter smallint NOT NULL,
    verse smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bible_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bible_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    book_id smallint NOT NULL,
    chapter smallint NOT NULL,
    verse smallint NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bible_notes_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 2000)))
);


--
-- Name: bible_verses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bible_verses (
    book_id smallint NOT NULL,
    chapter smallint NOT NULL,
    verse smallint NOT NULL,
    text text NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig, public.immutable_unaccent(text))) STORED
);


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks (
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blocks_not_self CHECK ((blocker_id <> blocked_id))
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hidden_at timestamp with time zone,
    hidden_by uuid,
    held_at timestamp with time zone,
    crisis_flagged_at timestamp with time zone,
    CONSTRAINT comments_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 1000)))
);


--
-- Name: content_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    author_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    claimed_by uuid,
    claimed_at timestamp with time zone,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_holds_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'claimed'::text, 'released'::text, 'removed'::text]))),
    CONSTRAINT content_holds_target_type_check CHECK ((target_type = ANY (ARRAY['post'::text, 'comment'::text])))
);


--
-- Name: conversation_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_members (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crisis_escalations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crisis_escalations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    author_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    note text,
    CONSTRAINT crisis_escalations_target_type_check CHECK ((target_type = ANY (ARRAY['post'::text, 'comment'::text])))
);


--
-- Name: daily_verses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_verses (
    ord smallint NOT NULL,
    book_id smallint NOT NULL,
    chapter smallint NOT NULL,
    verse smallint NOT NULL
);


--
-- Name: feature_flag_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flag_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flag_key text NOT NULL,
    action text NOT NULL,
    actor text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feature_flag_events_action_check CHECK ((action = ANY (ARRAY['enable'::text, 'disable'::text]))),
    CONSTRAINT feature_flag_events_actor_check CHECK ((char_length(btrim(actor)) > 0)),
    CONSTRAINT feature_flag_events_reason_check CHECK ((char_length(btrim(reason)) > 0))
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    owner text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feature_flags_owner_check CHECK ((char_length(btrim(owner)) > 0)),
    CONSTRAINT feature_flags_reason_check CHECK ((char_length(btrim(reason)) > 0))
);


--
-- Name: follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follows (
    follower_id uuid NOT NULL,
    followee_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follows_not_self CHECK ((follower_id <> followee_id))
);


--
-- Name: generation_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generation_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    scope text NOT NULL,
    plan_id uuid,
    group_id uuid,
    duration_days smallint,
    from_day smallint,
    to_day smallint,
    status text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT generation_ledger_scope_check CHECK ((scope = ANY (ARRAY['personal'::text, 'circle'::text, 'continuation'::text]))),
    CONSTRAINT generation_ledger_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.group_role DEFAULT 'member'::public.group_role NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: group_prayer_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_prayer_days (
    group_id uuid NOT NULL,
    plan_day_id uuid NOT NULL,
    user_id uuid NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    avatar_url text,
    visibility public.group_visibility DEFAULT 'private'::public.group_visibility NOT NULL,
    invite_token text DEFAULT public.generate_token() NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    streak_count integer DEFAULT 0 NOT NULL,
    streak_last_day date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig, public.immutable_unaccent(((name || ' '::text) || COALESCE(description, ''::text))))) STORED,
    CONSTRAINT groups_description_check CHECK ((char_length(description) <= 500)),
    CONSTRAINT groups_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80)))
);


--
-- Name: intercessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intercessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_day_id uuid NOT NULL,
    plan_owner_id uuid NOT NULL,
    intercessor_id uuid NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message_hidden_at timestamp with time zone,
    CONSTRAINT intercessions_message_check CHECK ((char_length(message) <= 280)),
    CONSTRAINT intercessions_not_self CHECK ((plan_owner_id <> intercessor_id))
);


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text DEFAULT public.generate_token() NOT NULL,
    inviter_id uuid NOT NULL,
    channel text,
    accepted_by uuid,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hidden_at timestamp with time zone,
    hidden_by uuid,
    CONSTRAINT messages_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 4000)))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    dedupe_key text,
    read_at timestamp with time zone,
    push_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plan_generation_leases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_generation_leases (
    plan_id uuid NOT NULL,
    request_id uuid NOT NULL,
    from_day smallint NOT NULL,
    to_day smallint NOT NULL,
    lease_id uuid NOT NULL,
    claimed_by uuid NOT NULL,
    leased_until timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plan_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    shared_with_user_id uuid,
    group_id uuid,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plan_shares_one_target CHECK ((num_nonnulls(shared_with_user_id, group_id) = 1))
);


--
-- Name: plus_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plus_waitlist (
    user_id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plus_waitlist_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 80)))
);


--
-- Name: post_prayers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_prayers (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    group_id uuid,
    body text NOT NULL,
    is_anonymous boolean DEFAULT false NOT NULL,
    prayer_count integer DEFAULT 0 NOT NULL,
    comment_count integer DEFAULT 0 NOT NULL,
    answered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hidden_at timestamp with time zone,
    hidden_by uuid,
    held_at timestamp with time zone,
    crisis_flagged_at timestamp with time zone,
    CONSTRAINT posts_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 2000)))
);


--
-- Name: prayer_list_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prayer_list_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    body text NOT NULL,
    tag text,
    answered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT prayer_list_items_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 280))),
    CONSTRAINT prayer_list_items_tag_check CHECK ((char_length(tag) <= 40))
);


--
-- Name: prayer_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prayer_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_day_id uuid NOT NULL,
    note text,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT prayer_logs_note_check CHECK ((char_length(note) <= 2000))
);


--
-- Name: prayer_plan_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prayer_plan_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    day_number smallint NOT NULL,
    title text NOT NULL,
    scripture_ref text,
    scripture_text text,
    prayer_body text NOT NULL,
    unlock_date date NOT NULL,
    intercession_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    interpretation text,
    daily_action text,
    intercessor_prayer text,
    CONSTRAINT prayer_plan_days_day_number_check CHECK ((day_number >= 1))
);


--
-- Name: prayer_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prayer_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    title text NOT NULL,
    theme text,
    duration_days smallint NOT NULL,
    start_date date DEFAULT public.local_today(auth.uid()) NOT NULL,
    visibility public.plan_visibility DEFAULT 'private'::public.plan_visibility NOT NULL,
    group_id uuid,
    status public.plan_status DEFAULT 'active'::public.plan_status NOT NULL,
    generated_by public.plan_source DEFAULT 'ai'::public.plan_source NOT NULL,
    source_prompt jsonb,
    generation_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generation_heartbeat_at timestamp with time zone,
    CONSTRAINT prayer_plans_duration_days_check CHECK (((duration_days >= 1) AND (duration_days <= 90))),
    CONSTRAINT prayer_plans_group_required CHECK (((visibility <> 'group'::public.plan_visibility) OR (group_id IS NOT NULL))),
    CONSTRAINT prayer_plans_theme_check CHECK ((char_length(theme) <= 140)),
    CONSTRAINT prayer_plans_title_check CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 140)))
);


--
-- Name: COLUMN prayer_plans.generation_heartbeat_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.prayer_plans.generation_heartbeat_at IS 'Latido de generación: cada tramo completado lo refresca. Independiente de
   updated_at (rename/visibility), para que el detector de atascos no se
   resetee por acciones que no son de generación.';


--
-- Name: profile_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_settings (
    id uuid NOT NULL,
    locale text DEFAULT 'es'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    onboarding_answers jsonb,
    expo_push_token text,
    pending_share_token text,
    pending_invite_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_book_id smallint,
    last_read_chapter smallint,
    last_read_verse smallint,
    last_read_at timestamp with time zone,
    active_plan_id uuid,
    reminder_hours smallint[] DEFAULT ARRAY[(8)::smallint] NOT NULL,
    terms_version text,
    terms_accepted_at timestamp with time zone,
    signup_source text,
    CONSTRAINT profile_settings_reading_position_complete CHECK ((((last_read_book_id IS NULL) AND (last_read_chapter IS NULL)) OR ((last_read_book_id IS NOT NULL) AND (last_read_chapter IS NOT NULL)))),
    CONSTRAINT profile_settings_reminder_hours_valid CHECK ((((COALESCE(array_length(reminder_hours, 1), 0) >= 0) AND (COALESCE(array_length(reminder_hours, 1), 0) <= 3)) AND (reminder_hours <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint, (7)::smallint, (8)::smallint, (9)::smallint, (10)::smallint, (11)::smallint, (12)::smallint, (13)::smallint, (14)::smallint, (15)::smallint, (16)::smallint, (17)::smallint, (18)::smallint, (19)::smallint, (20)::smallint, (21)::smallint, (22)::smallint, (23)::smallint])))
);


--
-- Name: COLUMN profile_settings.signup_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profile_settings.signup_source IS 'Por dónde entró: plan, imagen, invitacion, circulo. Se escribe una sola vez, al registrarse, y no se vuelve a tocar — reescribirlo con la última visita convertiría el dato de adquisición en un dato de uso.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    avatar_url text,
    streak_count integer DEFAULT 0 NOT NULL,
    streak_last_day date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    follower_count integer DEFAULT 0 NOT NULL,
    following_count integer DEFAULT 0 NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig, public.immutable_unaccent(display_name))) STORED,
    is_staff boolean DEFAULT false NOT NULL
);


--
-- Name: push_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    expo_push_token text NOT NULL,
    platform text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT push_devices_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))
);


--
-- Name: push_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intercession_id uuid NOT NULL,
    device_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    receipt_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    leased_until timestamp with time zone,
    CONSTRAINT push_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    reason text,
    status public.report_status DEFAULT 'open'::public.report_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reports_reason_check CHECK ((char_length(reason) <= 1000)),
    CONSTRAINT reports_target_type_check CHECK ((target_type = ANY (ARRAY['post'::text, 'comment'::text, 'message'::text, 'group'::text, 'profile'::text, 'intercession'::text, 'user'::text, 'testimony'::text])))
);


--
-- Name: share_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT public.generate_token() NOT NULL,
    scope public.share_scope NOT NULL,
    plan_id uuid,
    group_id uuid,
    created_by uuid NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT share_links_target_matches_scope CHECK ((((scope = 'plan'::public.share_scope) AND (plan_id IS NOT NULL) AND (group_id IS NULL)) OR ((scope = 'group'::public.share_scope) AND (group_id IS NOT NULL) AND (plan_id IS NULL))))
);


--
-- Name: staff_admin_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_admin_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_user_id uuid,
    action text NOT NULL,
    actor text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_admin_events_action_check CHECK ((action = ANY (ARRAY['grant'::text, 'revoke'::text]))),
    CONSTRAINT staff_admin_events_actor_check CHECK ((char_length(btrim(actor)) > 0)),
    CONSTRAINT staff_admin_events_reason_check CHECK ((char_length(btrim(reason)) > 0))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    user_id uuid NOT NULL,
    revenuecat_customer_id text,
    entitlement text,
    status text DEFAULT 'inactive'::text NOT NULL,
    store text,
    expires_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: testimonies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.testimonies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid,
    post_id uuid,
    body text NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    visibility public.testimony_visibility DEFAULT 'circles'::public.testimony_visibility NOT NULL,
    list_item_id uuid,
    CONSTRAINT testimonies_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 2000)))
);


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2026_09_18; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_09_18 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_09_19; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_09_19 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_09_20; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_09_20 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_09_21; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_09_21 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_09_22; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_09_22 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_09_23; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_09_23 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_09_24; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_09_24 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    selected_columns text[],
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: iceberg_namespaces; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_namespaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    catalog_id uuid NOT NULL
);


--
-- Name: iceberg_tables; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namespace_id uuid NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    location text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    remote_table_id text,
    shard_key text,
    shard_id text,
    catalog_id uuid NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hooks; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.hooks (
    id bigint NOT NULL,
    hook_table_id integer NOT NULL,
    hook_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id bigint
);


--
-- Name: TABLE hooks; Type: COMMENT; Schema: supabase_functions; Owner: -
--

COMMENT ON TABLE supabase_functions.hooks IS 'Supabase Functions Hooks: Audit trail for triggered hooks.';


--
-- Name: hooks_id_seq; Type: SEQUENCE; Schema: supabase_functions; Owner: -
--

CREATE SEQUENCE supabase_functions.hooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hooks_id_seq; Type: SEQUENCE OWNED BY; Schema: supabase_functions; Owner: -
--

ALTER SEQUENCE supabase_functions.hooks_id_seq OWNED BY supabase_functions.hooks.id;


--
-- Name: migrations; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.migrations (
    version text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


--
-- Name: messages_2026_09_18; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_09_18 FOR VALUES FROM ('2026-09-18 00:00:00') TO ('2026-09-19 00:00:00');


--
-- Name: messages_2026_09_19; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_09_19 FOR VALUES FROM ('2026-09-19 00:00:00') TO ('2026-09-20 00:00:00');


--
-- Name: messages_2026_09_20; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_09_20 FOR VALUES FROM ('2026-09-20 00:00:00') TO ('2026-09-21 00:00:00');


--
-- Name: messages_2026_09_21; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_09_21 FOR VALUES FROM ('2026-09-21 00:00:00') TO ('2026-09-22 00:00:00');


--
-- Name: messages_2026_09_22; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_09_22 FOR VALUES FROM ('2026-09-22 00:00:00') TO ('2026-09-23 00:00:00');


--
-- Name: messages_2026_09_23; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_09_23 FOR VALUES FROM ('2026-09-23 00:00:00') TO ('2026-09-24 00:00:00');


--
-- Name: messages_2026_09_24; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_09_24 FOR VALUES FROM ('2026-09-24 00:00:00') TO ('2026-09-25 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: hooks id; Type: DEFAULT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks ALTER COLUMN id SET DEFAULT nextval('supabase_functions.hooks_id_seq'::regclass);


--
-- Name: extensions extensions_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.extensions
    ADD CONSTRAINT extensions_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: bible_book_aliases bible_book_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_book_aliases
    ADD CONSTRAINT bible_book_aliases_pkey PRIMARY KEY (alias);


--
-- Name: bible_books bible_books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_books
    ADD CONSTRAINT bible_books_pkey PRIMARY KEY (id);


--
-- Name: bible_highlights bible_highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_highlights
    ADD CONSTRAINT bible_highlights_pkey PRIMARY KEY (user_id, book_id, chapter, verse);


--
-- Name: bible_notes bible_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_notes
    ADD CONSTRAINT bible_notes_pkey PRIMARY KEY (id);


--
-- Name: bible_notes bible_notes_user_id_book_id_chapter_verse_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_notes
    ADD CONSTRAINT bible_notes_user_id_book_id_chapter_verse_key UNIQUE (user_id, book_id, chapter, verse);


--
-- Name: bible_verses bible_verses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_verses
    ADD CONSTRAINT bible_verses_pkey PRIMARY KEY (book_id, chapter, verse);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (blocker_id, blocked_id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: content_holds content_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_holds
    ADD CONSTRAINT content_holds_pkey PRIMARY KEY (id);


--
-- Name: conversation_members conversation_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_members
    ADD CONSTRAINT conversation_members_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: conversations conversations_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_group_id_key UNIQUE (group_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: crisis_escalations crisis_escalations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crisis_escalations
    ADD CONSTRAINT crisis_escalations_pkey PRIMARY KEY (id);


--
-- Name: daily_verses daily_verses_book_id_chapter_verse_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_verses
    ADD CONSTRAINT daily_verses_book_id_chapter_verse_key UNIQUE (book_id, chapter, verse);


--
-- Name: daily_verses daily_verses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_verses
    ADD CONSTRAINT daily_verses_pkey PRIMARY KEY (ord);


--
-- Name: feature_flag_events feature_flag_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flag_events
    ADD CONSTRAINT feature_flag_events_pkey PRIMARY KEY (id);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (key);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, followee_id);


--
-- Name: generation_ledger generation_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_ledger
    ADD CONSTRAINT generation_ledger_pkey PRIMARY KEY (id);


--
-- Name: generation_ledger generation_ledger_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_ledger
    ADD CONSTRAINT generation_ledger_request_id_key UNIQUE (request_id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id);


--
-- Name: group_prayer_days group_prayer_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_prayer_days
    ADD CONSTRAINT group_prayer_days_pkey PRIMARY KEY (group_id, plan_day_id, user_id);


--
-- Name: groups groups_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_invite_token_key UNIQUE (invite_token);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: intercessions intercessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intercessions
    ADD CONSTRAINT intercessions_pkey PRIMARY KEY (id);


--
-- Name: intercessions intercessions_plan_day_id_intercessor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intercessions
    ADD CONSTRAINT intercessions_plan_day_id_intercessor_id_key UNIQUE (plan_day_id, intercessor_id);


--
-- Name: invites invites_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_code_key UNIQUE (code);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: plan_generation_leases plan_generation_leases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_generation_leases
    ADD CONSTRAINT plan_generation_leases_pkey PRIMARY KEY (plan_id);


--
-- Name: plan_generation_leases plan_generation_leases_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_generation_leases
    ADD CONSTRAINT plan_generation_leases_request_id_key UNIQUE (request_id);


--
-- Name: plan_shares plan_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_shares
    ADD CONSTRAINT plan_shares_pkey PRIMARY KEY (id);


--
-- Name: plus_waitlist plus_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plus_waitlist
    ADD CONSTRAINT plus_waitlist_pkey PRIMARY KEY (user_id);


--
-- Name: post_prayers post_prayers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_prayers
    ADD CONSTRAINT post_prayers_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: prayer_list_items prayer_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_list_items
    ADD CONSTRAINT prayer_list_items_pkey PRIMARY KEY (id);


--
-- Name: prayer_logs prayer_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_logs
    ADD CONSTRAINT prayer_logs_pkey PRIMARY KEY (id);


--
-- Name: prayer_logs prayer_logs_user_id_plan_day_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_logs
    ADD CONSTRAINT prayer_logs_user_id_plan_day_id_key UNIQUE (user_id, plan_day_id);


--
-- Name: prayer_plan_days prayer_plan_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_plan_days
    ADD CONSTRAINT prayer_plan_days_pkey PRIMARY KEY (id);


--
-- Name: prayer_plan_days prayer_plan_days_plan_id_day_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_plan_days
    ADD CONSTRAINT prayer_plan_days_plan_id_day_number_key UNIQUE (plan_id, day_number);


--
-- Name: prayer_plans prayer_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_plans
    ADD CONSTRAINT prayer_plans_pkey PRIMARY KEY (id);


--
-- Name: profile_settings profile_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_settings
    ADD CONSTRAINT profile_settings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_devices push_devices_expo_push_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_expo_push_token_key UNIQUE (expo_push_token);


--
-- Name: push_devices push_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_pkey PRIMARY KEY (id);


--
-- Name: push_outbox push_outbox_intercession_id_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_outbox
    ADD CONSTRAINT push_outbox_intercession_id_device_id_key UNIQUE (intercession_id, device_id);


--
-- Name: push_outbox push_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_outbox
    ADD CONSTRAINT push_outbox_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: share_links share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_pkey PRIMARY KEY (id);


--
-- Name: share_links share_links_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_token_key UNIQUE (token);


--
-- Name: staff_admin_events staff_admin_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_admin_events
    ADD CONSTRAINT staff_admin_events_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (user_id);


--
-- Name: testimonies testimonies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonies
    ADD CONSTRAINT testimonies_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_09_18 messages_2026_09_18_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_09_18
    ADD CONSTRAINT messages_2026_09_18_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_09_19 messages_2026_09_19_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_09_19
    ADD CONSTRAINT messages_2026_09_19_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_09_20 messages_2026_09_20_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_09_20
    ADD CONSTRAINT messages_2026_09_20_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_09_21 messages_2026_09_21_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_09_21
    ADD CONSTRAINT messages_2026_09_21_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_09_22 messages_2026_09_22_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_09_22
    ADD CONSTRAINT messages_2026_09_22_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_09_23 messages_2026_09_23_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_09_23
    ADD CONSTRAINT messages_2026_09_23_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_09_24 messages_2026_09_24_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_09_24
    ADD CONSTRAINT messages_2026_09_24_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages messages_payload_exclusive; Type: CHECK CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages
    ADD CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL))) NOT VALID;


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: iceberg_namespaces iceberg_namespaces_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_pkey PRIMARY KEY (id);


--
-- Name: iceberg_tables iceberg_tables_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: hooks hooks_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks
    ADD CONSTRAINT hooks_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (version);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


--
-- Name: extensions_tenant_external_id_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE INDEX extensions_tenant_external_id_index ON _realtime.extensions USING btree (tenant_external_id);


--
-- Name: extensions_tenant_external_id_type_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE UNIQUE INDEX extensions_tenant_external_id_type_index ON _realtime.extensions USING btree (tenant_external_id, type);


--
-- Name: feature_flags_name_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE UNIQUE INDEX feature_flags_name_index ON _realtime.feature_flags USING btree (name);


--
-- Name: tenants_external_id_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE UNIQUE INDEX tenants_external_id_index ON _realtime.tenants USING btree (external_id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: bible_highlights_chapter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bible_highlights_chapter_idx ON public.bible_highlights USING btree (user_id, book_id, chapter);


--
-- Name: bible_notes_chapter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bible_notes_chapter_idx ON public.bible_notes USING btree (user_id, book_id, chapter);


--
-- Name: bible_verses_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bible_verses_search_idx ON public.bible_verses USING gin (search_vector);


--
-- Name: blocks_blocked_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blocks_blocked_idx ON public.blocks USING btree (blocked_id);


--
-- Name: comments_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_post_idx ON public.comments USING btree (post_id, created_at);


--
-- Name: content_holds_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_holds_queue_idx ON public.content_holds USING btree (status, created_at);


--
-- Name: content_holds_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_holds_target_idx ON public.content_holds USING btree (target_type, target_id);


--
-- Name: conversation_members_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_members_user_idx ON public.conversation_members USING btree (user_id);


--
-- Name: crisis_escalations_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crisis_escalations_open_idx ON public.crisis_escalations USING btree (acknowledged_at, created_at);


--
-- Name: crisis_escalations_open_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crisis_escalations_open_order_idx ON public.crisis_escalations USING btree (created_at, id) WHERE (acknowledged_at IS NULL);


--
-- Name: follows_followee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follows_followee_idx ON public.follows USING btree (followee_id);


--
-- Name: generation_ledger_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX generation_ledger_plan_idx ON public.generation_ledger USING btree (plan_id);


--
-- Name: generation_ledger_user_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX generation_ledger_user_scope_idx ON public.generation_ledger USING btree (user_id, scope) WHERE (scope = ANY (ARRAY['personal'::text, 'circle'::text]));


--
-- Name: group_members_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_user_idx ON public.group_members USING btree (user_id);


--
-- Name: groups_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_owner_idx ON public.groups USING btree (owner_id);


--
-- Name: groups_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_public_idx ON public.groups USING btree (visibility) WHERE (visibility = 'public'::public.group_visibility);


--
-- Name: groups_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_search_idx ON public.groups USING gin (search_vector);


--
-- Name: intercessions_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX intercessions_owner_idx ON public.intercessions USING btree (plan_owner_id, created_at DESC);


--
-- Name: invites_inviter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invites_inviter_idx ON public.invites USING btree (inviter_id);


--
-- Name: messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: notifications_dedupe_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_dedupe_uniq ON public.notifications USING btree (user_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);


--
-- Name: notifications_pending_push_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_pending_push_idx ON public.notifications USING btree (created_at) WHERE (push_sent_at IS NULL);


--
-- Name: notifications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: plan_shares_group_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX plan_shares_group_uniq ON public.plan_shares USING btree (plan_id, group_id) WHERE (group_id IS NOT NULL);


--
-- Name: plan_shares_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_shares_user_idx ON public.plan_shares USING btree (shared_with_user_id) WHERE (shared_with_user_id IS NOT NULL);


--
-- Name: plan_shares_user_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX plan_shares_user_uniq ON public.plan_shares USING btree (plan_id, shared_with_user_id) WHERE (shared_with_user_id IS NOT NULL);


--
-- Name: posts_feed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_feed_idx ON public.posts USING btree (created_at DESC);


--
-- Name: posts_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_group_idx ON public.posts USING btree (group_id, created_at DESC) WHERE (group_id IS NOT NULL);


--
-- Name: prayer_list_items_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prayer_list_items_user_idx ON public.prayer_list_items USING btree (user_id, answered_at NULLS FIRST, created_at DESC);


--
-- Name: prayer_logs_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prayer_logs_user_idx ON public.prayer_logs USING btree (user_id);


--
-- Name: prayer_plan_days_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prayer_plan_days_plan_idx ON public.prayer_plan_days USING btree (plan_id);


--
-- Name: prayer_plans_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prayer_plans_group_idx ON public.prayer_plans USING btree (group_id) WHERE (group_id IS NOT NULL);


--
-- Name: prayer_plans_one_active_per_group; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX prayer_plans_one_active_per_group ON public.prayer_plans USING btree (group_id) WHERE ((group_id IS NOT NULL) AND (status = ANY (ARRAY['generating'::public.plan_status, 'active'::public.plan_status])));


--
-- Name: prayer_plans_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prayer_plans_owner_idx ON public.prayer_plans USING btree (owner_id);


--
-- Name: profiles_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_search_idx ON public.profiles USING gin (search_vector);


--
-- Name: push_devices_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_devices_user_idx ON public.push_devices USING btree (user_id) WHERE (revoked_at IS NULL);


--
-- Name: push_outbox_claimable_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_outbox_claimable_idx ON public.push_outbox USING btree (next_attempt_at) WHERE (status = 'pending'::text);


--
-- Name: push_outbox_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_outbox_pending_idx ON public.push_outbox USING btree (status, created_at) WHERE (status = 'pending'::text);


--
-- Name: push_outbox_receipt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_outbox_receipt_idx ON public.push_outbox USING btree (receipt_id) WHERE (receipt_id IS NOT NULL);


--
-- Name: reports_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_open_idx ON public.reports USING btree (created_at DESC) WHERE (status = 'open'::public.report_status);


--
-- Name: share_links_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX share_links_plan_idx ON public.share_links USING btree (plan_id) WHERE (plan_id IS NOT NULL);


--
-- Name: testimonies_visible_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX testimonies_visible_idx ON public.testimonies USING btree (created_at DESC) WHERE (visibility <> 'private'::public.testimony_visibility);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_09_18_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_09_18_inserted_at_topic_idx ON realtime.messages_2026_09_18 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_09_19_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_09_19_inserted_at_topic_idx ON realtime.messages_2026_09_19 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_09_20_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_09_20_inserted_at_topic_idx ON realtime.messages_2026_09_20 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_09_21_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_09_21_inserted_at_topic_idx ON realtime.messages_2026_09_21 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_09_22_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_09_22_inserted_at_topic_idx ON realtime.messages_2026_09_22 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_09_23_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_09_23_inserted_at_topic_idx ON realtime.messages_2026_09_23 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_09_24_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_09_24_inserted_at_topic_idx ON realtime.messages_2026_09_24 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_selec; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_selec ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter, COALESCE(selected_columns, '{}'::text[]));


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_iceberg_namespaces_bucket_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_namespaces_bucket_id ON storage.iceberg_namespaces USING btree (catalog_id, name);


--
-- Name: idx_iceberg_tables_location; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_location ON storage.iceberg_tables USING btree (location);


--
-- Name: idx_iceberg_tables_namespace_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_namespace_id ON storage.iceberg_tables USING btree (catalog_id, namespace_id, name);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: supabase_functions_hooks_h_table_id_h_name_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name);


--
-- Name: supabase_functions_hooks_request_id_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id);


--
-- Name: messages_2026_09_18_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_09_18_inserted_at_topic_idx;


--
-- Name: messages_2026_09_18_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_09_18_pkey;


--
-- Name: messages_2026_09_19_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_09_19_inserted_at_topic_idx;


--
-- Name: messages_2026_09_19_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_09_19_pkey;


--
-- Name: messages_2026_09_20_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_09_20_inserted_at_topic_idx;


--
-- Name: messages_2026_09_20_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_09_20_pkey;


--
-- Name: messages_2026_09_21_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_09_21_inserted_at_topic_idx;


--
-- Name: messages_2026_09_21_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_09_21_pkey;


--
-- Name: messages_2026_09_22_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_09_22_inserted_at_topic_idx;


--
-- Name: messages_2026_09_22_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_09_22_pkey;


--
-- Name: messages_2026_09_23_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_09_23_inserted_at_topic_idx;


--
-- Name: messages_2026_09_23_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_09_23_pkey;


--
-- Name: messages_2026_09_24_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_09_24_inserted_at_topic_idx;


--
-- Name: messages_2026_09_24_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_09_24_pkey;


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: bible_notes bible_notes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bible_notes_set_updated_at BEFORE UPDATE ON public.bible_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: blocks blocks_clear_follows; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER blocks_clear_follows AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.clear_follows_on_block();


--
-- Name: comments comments_counter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comments_counter AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.sync_post_counters();


--
-- Name: comments comments_enqueue_crisis; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comments_enqueue_crisis AFTER INSERT OR UPDATE OF body ON public.comments FOR EACH ROW EXECUTE FUNCTION public.enqueue_crisis_escalation('comment');


--
-- Name: comments comments_enqueue_hold; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comments_enqueue_hold AFTER INSERT OR UPDATE OF body ON public.comments FOR EACH ROW EXECUTE FUNCTION public.enqueue_content_hold('comment');


--
-- Name: comments comments_flag_crisis; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comments_flag_crisis BEFORE INSERT OR UPDATE OF body ON public.comments FOR EACH ROW EXECUTE FUNCTION public.flag_crisis();


--
-- Name: comments comments_hold_objectionable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comments_hold_objectionable BEFORE INSERT OR UPDATE OF body ON public.comments FOR EACH ROW EXECUTE FUNCTION public.hold_objectionable();


--
-- Name: follows follows_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER follows_count AFTER INSERT OR DELETE ON public.follows FOR EACH ROW EXECUTE FUNCTION public.sync_follow_counts();


--
-- Name: group_members group_members_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER group_members_count AFTER INSERT OR DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.sync_group_member_count();


--
-- Name: group_members group_members_protect_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER group_members_protect_owner BEFORE DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.protect_group_owner();


--
-- Name: group_prayer_days group_prayer_days_bump_streak; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER group_prayer_days_bump_streak AFTER INSERT ON public.group_prayer_days FOR EACH ROW EXECUTE FUNCTION public.bump_group_streak();


--
-- Name: groups groups_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER groups_set_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: intercessions intercessions_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intercessions_count AFTER INSERT OR DELETE ON public.intercessions FOR EACH ROW EXECUTE FUNCTION public.sync_intercession_count();


--
-- Name: intercessions intercessions_enqueue_push; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intercessions_enqueue_push AFTER INSERT ON public.intercessions FOR EACH ROW EXECUTE FUNCTION public.enqueue_push_outbox();


--
-- Name: intercessions intercessions_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intercessions_notify AFTER INSERT ON public.intercessions FOR EACH ROW EXECUTE FUNCTION public.notify_on_intercession();


--
-- Name: intercessions intercessions_set_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intercessions_set_owner BEFORE INSERT ON public.intercessions FOR EACH ROW EXECUTE FUNCTION public.set_intercession_owner();


--
-- Name: groups on_group_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_group_created AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();


--
-- Name: groups on_group_created_conversation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_group_created_conversation AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.handle_new_group_conversation();


--
-- Name: post_prayers post_prayers_counter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_prayers_counter AFTER INSERT OR DELETE ON public.post_prayers FOR EACH ROW EXECUTE FUNCTION public.sync_post_counters();


--
-- Name: posts posts_enqueue_crisis; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER posts_enqueue_crisis AFTER INSERT OR UPDATE OF body ON public.posts FOR EACH ROW EXECUTE FUNCTION public.enqueue_crisis_escalation('post');


--
-- Name: posts posts_enqueue_hold; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER posts_enqueue_hold AFTER INSERT OR UPDATE OF body ON public.posts FOR EACH ROW EXECUTE FUNCTION public.enqueue_content_hold('post');


--
-- Name: posts posts_flag_crisis; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER posts_flag_crisis BEFORE INSERT OR UPDATE OF body ON public.posts FOR EACH ROW EXECUTE FUNCTION public.flag_crisis();


--
-- Name: posts posts_hold_objectionable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER posts_hold_objectionable BEFORE INSERT OR UPDATE OF body ON public.posts FOR EACH ROW EXECUTE FUNCTION public.hold_objectionable();


--
-- Name: posts posts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: prayer_list_items prayer_list_items_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prayer_list_items_set_updated_at BEFORE UPDATE ON public.prayer_list_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: prayer_logs prayer_logs_bump_streak; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prayer_logs_bump_streak AFTER INSERT ON public.prayer_logs FOR EACH ROW EXECUTE FUNCTION public.bump_personal_streak();


--
-- Name: prayer_plans prayer_plans_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prayer_plans_set_updated_at BEFORE UPDATE ON public.prayer_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profile_settings profile_settings_normalize_timezone; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profile_settings_normalize_timezone BEFORE INSERT OR UPDATE OF timezone ON public.profile_settings FOR EACH ROW EXECUTE FUNCTION public.normalize_settings_timezone();


--
-- Name: profile_settings profile_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profile_settings_set_updated_at BEFORE UPDATE ON public.profile_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profile_settings profile_settings_validate_active_plan; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profile_settings_validate_active_plan BEFORE INSERT OR UPDATE OF active_plan_id ON public.profile_settings FOR EACH ROW EXECUTE FUNCTION public.validate_active_plan();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles profiles_validate_avatar_url; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_validate_avatar_url BEFORE INSERT OR UPDATE OF avatar_url ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_avatar_url();


--
-- Name: share_links share_links_set_expiry; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER share_links_set_expiry BEFORE INSERT ON public.share_links FOR EACH ROW EXECUTE FUNCTION public.set_share_link_expiry();


--
-- Name: subscriptions subscriptions_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: extensions extensions_tenant_external_id_fkey; Type: FK CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.extensions
    ADD CONSTRAINT extensions_tenant_external_id_fkey FOREIGN KEY (tenant_external_id) REFERENCES _realtime.tenants(external_id) ON DELETE CASCADE;


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bible_book_aliases bible_book_aliases_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_book_aliases
    ADD CONSTRAINT bible_book_aliases_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.bible_books(id);


--
-- Name: bible_highlights bible_highlights_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_highlights
    ADD CONSTRAINT bible_highlights_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.bible_books(id);


--
-- Name: bible_highlights bible_highlights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_highlights
    ADD CONSTRAINT bible_highlights_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: bible_notes bible_notes_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_notes
    ADD CONSTRAINT bible_notes_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.bible_books(id);


--
-- Name: bible_notes bible_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_notes
    ADD CONSTRAINT bible_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: bible_verses bible_verses_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bible_verses
    ADD CONSTRAINT bible_verses_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.bible_books(id);


--
-- Name: blocks blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: comments comments_hidden_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: content_holds content_holds_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_holds
    ADD CONSTRAINT content_holds_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: content_holds content_holds_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_holds
    ADD CONSTRAINT content_holds_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: content_holds content_holds_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_holds
    ADD CONSTRAINT content_holds_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: conversation_members conversation_members_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_members
    ADD CONSTRAINT conversation_members_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_members conversation_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_members
    ADD CONSTRAINT conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: crisis_escalations crisis_escalations_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crisis_escalations
    ADD CONSTRAINT crisis_escalations_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: crisis_escalations crisis_escalations_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crisis_escalations
    ADD CONSTRAINT crisis_escalations_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: daily_verses daily_verses_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_verses
    ADD CONSTRAINT daily_verses_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.bible_books(id);


--
-- Name: follows follows_followee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_followee_id_fkey FOREIGN KEY (followee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: generation_ledger generation_ledger_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_ledger
    ADD CONSTRAINT generation_ledger_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: generation_ledger generation_ledger_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_ledger
    ADD CONSTRAINT generation_ledger_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.prayer_plans(id) ON DELETE SET NULL;


--
-- Name: generation_ledger generation_ledger_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generation_ledger
    ADD CONSTRAINT generation_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: group_prayer_days group_prayer_days_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_prayer_days
    ADD CONSTRAINT group_prayer_days_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_prayer_days group_prayer_days_plan_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_prayer_days
    ADD CONSTRAINT group_prayer_days_plan_day_id_fkey FOREIGN KEY (plan_day_id) REFERENCES public.prayer_plan_days(id) ON DELETE CASCADE;


--
-- Name: group_prayer_days group_prayer_days_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_prayer_days
    ADD CONSTRAINT group_prayer_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: groups groups_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: intercessions intercessions_intercessor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intercessions
    ADD CONSTRAINT intercessions_intercessor_id_fkey FOREIGN KEY (intercessor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: intercessions intercessions_plan_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intercessions
    ADD CONSTRAINT intercessions_plan_day_id_fkey FOREIGN KEY (plan_day_id) REFERENCES public.prayer_plan_days(id) ON DELETE CASCADE;


--
-- Name: intercessions intercessions_plan_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intercessions
    ADD CONSTRAINT intercessions_plan_owner_id_fkey FOREIGN KEY (plan_owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: invites invites_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: invites invites_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_hidden_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: plan_generation_leases plan_generation_leases_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_generation_leases
    ADD CONSTRAINT plan_generation_leases_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: plan_generation_leases plan_generation_leases_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_generation_leases
    ADD CONSTRAINT plan_generation_leases_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.prayer_plans(id) ON DELETE CASCADE;


--
-- Name: plan_shares plan_shares_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_shares
    ADD CONSTRAINT plan_shares_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: plan_shares plan_shares_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_shares
    ADD CONSTRAINT plan_shares_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: plan_shares plan_shares_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_shares
    ADD CONSTRAINT plan_shares_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.prayer_plans(id) ON DELETE CASCADE;


--
-- Name: plan_shares plan_shares_shared_with_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_shares
    ADD CONSTRAINT plan_shares_shared_with_user_id_fkey FOREIGN KEY (shared_with_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: plus_waitlist plus_waitlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plus_waitlist
    ADD CONSTRAINT plus_waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: post_prayers post_prayers_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_prayers
    ADD CONSTRAINT post_prayers_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_prayers post_prayers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_prayers
    ADD CONSTRAINT post_prayers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: posts posts_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: posts posts_hidden_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: prayer_list_items prayer_list_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_list_items
    ADD CONSTRAINT prayer_list_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: prayer_logs prayer_logs_plan_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_logs
    ADD CONSTRAINT prayer_logs_plan_day_id_fkey FOREIGN KEY (plan_day_id) REFERENCES public.prayer_plan_days(id) ON DELETE CASCADE;


--
-- Name: prayer_logs prayer_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_logs
    ADD CONSTRAINT prayer_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: prayer_plan_days prayer_plan_days_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_plan_days
    ADD CONSTRAINT prayer_plan_days_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.prayer_plans(id) ON DELETE CASCADE;


--
-- Name: prayer_plans prayer_plans_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_plans
    ADD CONSTRAINT prayer_plans_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;


--
-- Name: prayer_plans prayer_plans_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prayer_plans
    ADD CONSTRAINT prayer_plans_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profile_settings profile_settings_active_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_settings
    ADD CONSTRAINT profile_settings_active_plan_id_fkey FOREIGN KEY (active_plan_id) REFERENCES public.prayer_plans(id) ON DELETE SET NULL;


--
-- Name: profile_settings profile_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_settings
    ADD CONSTRAINT profile_settings_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profile_settings profile_settings_last_read_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_settings
    ADD CONSTRAINT profile_settings_last_read_book_id_fkey FOREIGN KEY (last_read_book_id) REFERENCES public.bible_books(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_devices push_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: push_outbox push_outbox_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_outbox
    ADD CONSTRAINT push_outbox_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.push_devices(id) ON DELETE CASCADE;


--
-- Name: push_outbox push_outbox_intercession_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_outbox
    ADD CONSTRAINT push_outbox_intercession_id_fkey FOREIGN KEY (intercession_id) REFERENCES public.intercessions(id) ON DELETE CASCADE;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: share_links share_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: share_links share_links_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: share_links share_links_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.prayer_plans(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: testimonies testimonies_list_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonies
    ADD CONSTRAINT testimonies_list_item_id_fkey FOREIGN KEY (list_item_id) REFERENCES public.prayer_list_items(id) ON DELETE SET NULL;


--
-- Name: testimonies testimonies_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonies
    ADD CONSTRAINT testimonies_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.prayer_plans(id) ON DELETE SET NULL;


--
-- Name: testimonies testimonies_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonies
    ADD CONSTRAINT testimonies_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE SET NULL;


--
-- Name: testimonies testimonies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonies
    ADD CONSTRAINT testimonies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: iceberg_namespaces iceberg_namespaces_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_namespace_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_namespace_id_fkey FOREIGN KEY (namespace_id) REFERENCES storage.iceberg_namespaces(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: group_members admins change roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins change roles" ON public.group_members FOR UPDATE TO authenticated USING (public.is_group_admin(group_id)) WITH CHECK (public.is_group_admin(group_id));


--
-- Name: groups admins update the group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins update the group" ON public.groups FOR UPDATE TO authenticated USING (public.is_group_admin(id)) WITH CHECK (public.is_group_admin(id));


--
-- Name: daily_verses anybody signed in reads the daily list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anybody signed in reads the daily list" ON public.daily_verses FOR SELECT TO authenticated USING (true);


--
-- Name: comments authors delete their comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authors delete their comments" ON public.comments FOR DELETE TO authenticated USING ((author_id = ( SELECT auth.uid() AS uid)));


--
-- Name: posts authors delete their posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authors delete their posts" ON public.posts FOR DELETE TO authenticated USING ((author_id = ( SELECT auth.uid() AS uid)));


--
-- Name: testimonies authors delete their testimony; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authors delete their testimony" ON public.testimonies FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: posts authors update their posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authors update their posts" ON public.posts FOR UPDATE TO authenticated USING ((author_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((author_id = ( SELECT auth.uid() AS uid)));


--
-- Name: testimonies authors update their testimony; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authors update their testimony" ON public.testimonies FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: bible_book_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bible_book_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: bible_books; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bible_books ENABLE ROW LEVEL SECURITY;

--
-- Name: bible_highlights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bible_highlights ENABLE ROW LEVEL SECURITY;

--
-- Name: bible_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bible_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: bible_verses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bible_verses ENABLE ROW LEVEL SECURITY;

--
-- Name: blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: bible_book_aliases book aliases are readable by signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "book aliases are readable by signed-in users" ON public.bible_book_aliases FOR SELECT TO authenticated USING (true);


--
-- Name: follows both sides see the follow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "both sides see the follow" ON public.follows FOR SELECT TO authenticated USING (((follower_id = ( SELECT auth.uid() AS uid)) OR (followee_id = ( SELECT auth.uid() AS uid))));


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: comments comments visible with the post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "comments visible with the post" ON public.comments FOR SELECT TO authenticated USING (((author_id = ( SELECT auth.uid() AS uid)) OR ((hidden_at IS NULL) AND (held_at IS NULL) AND (NOT public.has_blocked(author_id)) AND public.can_read_post(post_id))));


--
-- Name: content_holds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_holds ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: share_links creators manage their share links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "creators manage their share links" ON public.share_links TO authenticated USING ((created_by = ( SELECT auth.uid() AS uid))) WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));


--
-- Name: crisis_escalations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crisis_escalations ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_verses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_verses ENABLE ROW LEVEL SECURITY;

--
-- Name: follows either side ends the follow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "either side ends the follow" ON public.follows FOR DELETE TO authenticated USING (((follower_id = ( SELECT auth.uid() AS uid)) OR (followee_id = ( SELECT auth.uid() AS uid))));


--
-- Name: feature_flag_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flag_events ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: follows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

--
-- Name: generation_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.generation_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: group_prayer_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_prayer_days ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: intercessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.intercessions ENABLE ROW LEVEL SECURITY;

--
-- Name: intercessions intercessors can take it back; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "intercessors can take it back" ON public.intercessions FOR DELETE TO authenticated USING ((intercessor_id = ( SELECT auth.uid() AS uid)));


--
-- Name: invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_members members are added by participants or the creator; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members are added by participants or the creator" ON public.conversation_members FOR INSERT TO authenticated WITH CHECK ((public.is_conversation_member(conversation_id) OR (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_members.conversation_id) AND (c.created_by = ( SELECT auth.uid() AS uid)))))));


--
-- Name: conversation_members members leave a conversation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members leave a conversation" ON public.conversation_members FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: group_members members leave, admins remove; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members leave, admins remove" ON public.group_members FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_group_admin(group_id)));


--
-- Name: messages members read the messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read the messages" ON public.messages FOR SELECT TO authenticated USING ((public.is_conversation_member(conversation_id) AND (hidden_at IS NULL) AND (NOT public.has_blocked(sender_id))));


--
-- Name: conversation_members members read the participant list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read the participant list" ON public.conversation_members FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id));


--
-- Name: conversations members read their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read their conversations" ON public.conversations FOR SELECT TO authenticated USING (public.is_conversation_member(id));


--
-- Name: groups members read their groups, anyone reads public groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read their groups, anyone reads public groups" ON public.groups FOR SELECT TO authenticated USING (((visibility = 'public'::public.group_visibility) OR (owner_id = ( SELECT auth.uid() AS uid)) OR public.is_group_member(id)));


--
-- Name: group_prayer_days members record their own group day; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members record their own group day" ON public.group_prayer_days FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.is_group_member(group_id) AND public.can_read_plan_day(plan_day_id)));


--
-- Name: group_prayer_days members remove their own group day; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members remove their own group day" ON public.group_prayer_days FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: group_members members see the roster; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members see the roster" ON public.group_members FOR SELECT TO authenticated USING (public.is_group_member(group_id));


--
-- Name: group_prayer_days members see who prayed in the group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members see who prayed in the group" ON public.group_prayer_days FOR SELECT TO authenticated USING (public.is_group_member(group_id));


--
-- Name: messages members send messages as themselves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members send messages as themselves" ON public.messages FOR INSERT TO authenticated WITH CHECK (((sender_id = ( SELECT auth.uid() AS uid)) AND public.is_conversation_member(conversation_id)));


--
-- Name: conversation_members members update their own read marker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members update their own read marker" ON public.conversation_members FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: groups owner deletes the group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner deletes the group" ON public.groups FOR DELETE TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_plans owners delete their plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners delete their plans" ON public.prayer_plans FOR DELETE TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: generation_ledger owners read their own generation ledger; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners read their own generation ledger" ON public.generation_ledger FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_plan_days owners update their plan days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners update their plan days" ON public.prayer_plan_days FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.prayer_plans p
  WHERE ((p.id = prayer_plan_days.plan_id) AND (p.owner_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.prayer_plans p
  WHERE ((p.id = prayer_plan_days.plan_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: prayer_plans owners update their plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners update their plans" ON public.prayer_plans FOR UPDATE TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_plan_days owners write their plan days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners write their plan days" ON public.prayer_plan_days FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.prayer_plans p
  WHERE ((p.id = prayer_plan_days.plan_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: intercessions plan owner and intercessor see the intercession; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan owner and intercessor see the intercession" ON public.intercessions FOR SELECT TO authenticated USING (((plan_owner_id = ( SELECT auth.uid() AS uid)) OR (intercessor_id = ( SELECT auth.uid() AS uid))));


--
-- Name: intercessions plan owners hide a message sent to them; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan owners hide a message sent to them" ON public.intercessions FOR UPDATE TO authenticated USING ((plan_owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((plan_owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: plan_shares plan owners revoke shares; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan owners revoke shares" ON public.plan_shares FOR DELETE TO authenticated USING ((created_by = ( SELECT auth.uid() AS uid)));


--
-- Name: plan_shares plan owners share their own plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plan owners share their own plans" ON public.plan_shares FOR INSERT TO authenticated WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.prayer_plans p
  WHERE ((p.id = plan_shares.plan_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))) AND ((group_id IS NULL) OR public.is_group_member(group_id))));


--
-- Name: plan_generation_leases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_generation_leases ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_plans plans are readable by owner and people they are shared with; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "plans are readable by owner and people they are shared with" ON public.prayer_plans FOR SELECT TO authenticated USING (((owner_id = ( SELECT auth.uid() AS uid)) OR public.has_plan_share(id) OR ((group_id IS NOT NULL) AND public.is_group_member(group_id)) OR (visibility = 'public'::public.plan_visibility)));


--
-- Name: plus_waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plus_waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: post_prayers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_prayers ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_list_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prayer_list_items ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prayer_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_plan_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prayer_plan_days ENABLE ROW LEVEL SECURITY;

--
-- Name: prayer_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prayer_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: post_prayers prayers visible with the post; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "prayers visible with the post" ON public.post_prayers FOR SELECT TO authenticated USING (public.can_read_post(post_id));


--
-- Name: profile_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles are readable by signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles are readable by signed-in users" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: push_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: push_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: plus_waitlist reeditas tu propia entrada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reeditas tu propia entrada" ON public.plus_waitlist FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: bible_books scripture is readable by signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "scripture is readable by signed-in users" ON public.bible_books FOR SELECT TO authenticated USING (true);


--
-- Name: bible_verses scripture verses are readable by signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "scripture verses are readable by signed-in users" ON public.bible_verses FOR SELECT TO authenticated USING (true);


--
-- Name: messages senders delete their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "senders delete their own messages" ON public.messages FOR DELETE TO authenticated USING ((sender_id = ( SELECT auth.uid() AS uid)));


--
-- Name: share_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_shares shares visible to plan owner and recipient; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "shares visible to plan owner and recipient" ON public.plan_shares FOR SELECT TO authenticated USING (((created_by = ( SELECT auth.uid() AS uid)) OR (shared_with_user_id = ( SELECT auth.uid() AS uid)) OR ((group_id IS NOT NULL) AND public.is_group_member(group_id))));


--
-- Name: staff_admin_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_admin_events ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: plus_waitlist te apuntas tú; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "te apuntas tú" ON public.plus_waitlist FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: testimonies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.testimonies ENABLE ROW LEVEL SECURITY;

--
-- Name: plus_waitlist tu entrada en la lista es tuya; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tu entrada en la lista es tuya" ON public.plus_waitlist FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_plan_days unlocked days are readable by anyone who can read the plan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "unlocked days are readable by anyone who can read the plan" ON public.prayer_plan_days FOR SELECT TO authenticated USING (((unlock_date <= public.plan_today(plan_id)) AND public.can_read_plan(plan_id)));


--
-- Name: comments users comment on readable posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users comment on readable posts" ON public.comments FOR INSERT TO authenticated WITH CHECK (((author_id = ( SELECT auth.uid() AS uid)) AND public.can_read_post(post_id)));


--
-- Name: groups users create groups they own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users create groups they own" ON public.groups FOR INSERT TO authenticated WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: invites users create their own invites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users create their own invites" ON public.invites FOR INSERT TO authenticated WITH CHECK ((inviter_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_plans users create their own plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users create their own plans" ON public.prayer_plans FOR INSERT TO authenticated WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_logs users delete their own prayer logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete their own prayer logs" ON public.prayer_logs FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: reports users file reports as themselves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users file reports as themselves" ON public.reports FOR INSERT TO authenticated WITH CHECK ((reporter_id = ( SELECT auth.uid() AS uid)));


--
-- Name: group_members users join public groups, admins add members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users join public groups, admins add members" ON public.group_members FOR INSERT TO authenticated WITH CHECK ((((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.groups g
  WHERE ((g.id = group_members.group_id) AND (g.visibility = 'public'::public.group_visibility))))) OR public.is_group_admin(group_id)));


--
-- Name: prayer_logs users log their own prayers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users log their own prayers" ON public.prayer_logs FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.can_read_plan_day(plan_day_id)));


--
-- Name: notifications users mark their notifications read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users mark their notifications read" ON public.notifications FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: post_prayers users pray for a readable post once; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users pray for a readable post once" ON public.post_prayers FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.can_read_post(post_id)));


--
-- Name: intercessions users pray for days shared with them; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users pray for days shared with them" ON public.intercessions FOR INSERT TO authenticated WITH CHECK (((intercessor_id = ( SELECT auth.uid() AS uid)) AND public.can_pray_plan_day(plan_day_id)));


--
-- Name: invites users read the invites they sent or accepted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read the invites they sent or accepted" ON public.invites FOR SELECT TO authenticated USING (((inviter_id = ( SELECT auth.uid() AS uid)) OR (accepted_by = ( SELECT auth.uid() AS uid))));


--
-- Name: notifications users read their notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read their notifications" ON public.notifications FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_logs users read their own prayer logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read their own prayer logs" ON public.prayer_logs FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profile_settings users read their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read their own settings" ON public.profile_settings FOR SELECT TO authenticated USING ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: subscriptions users read their own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read their own subscription" ON public.subscriptions FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: reports users see the reports they filed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users see the reports they filed" ON public.reports FOR SELECT TO authenticated USING ((reporter_id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_devices users see their own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users see their own devices" ON public.push_devices FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: conversations users start conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users start conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));


--
-- Name: post_prayers users undo their own prayer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users undo their own prayer" ON public.post_prayers FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles users update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: profile_settings users update their own settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update their own settings" ON public.profile_settings FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: posts users write their own posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users write their own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (((author_id = ( SELECT auth.uid() AS uid)) AND ((group_id IS NULL) OR public.is_group_member(group_id))));


--
-- Name: testimonies users write their own testimony; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users write their own testimony" ON public.testimonies FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: blocks you block on your own behalf; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you block on your own behalf" ON public.blocks FOR INSERT TO authenticated WITH CHECK ((blocker_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_list_items you delete from your own list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you delete from your own list" ON public.prayer_list_items FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: bible_notes you delete your own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you delete your own notes" ON public.bible_notes FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_list_items you edit your own list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you edit your own list" ON public.prayer_list_items FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: bible_notes you edit your own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you edit your own notes" ON public.bible_notes FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: follows you follow on your own behalf; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you follow on your own behalf" ON public.follows FOR INSERT TO authenticated WITH CHECK (((follower_id = ( SELECT auth.uid() AS uid)) AND (NOT public.blocked_either_way(followee_id))));


--
-- Name: bible_highlights you highlight for yourself; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you highlight for yourself" ON public.bible_highlights FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: blocks you read your own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you read your own blocks" ON public.blocks FOR SELECT TO authenticated USING ((blocker_id = ( SELECT auth.uid() AS uid)));


--
-- Name: bible_highlights you remove your own highlights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you remove your own highlights" ON public.bible_highlights FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: blocks you unblock what you blocked; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you unblock what you blocked" ON public.blocks FOR DELETE TO authenticated USING ((blocker_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_list_items you write your own list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you write your own list" ON public.prayer_list_items FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: bible_notes you write your own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "you write your own notes" ON public.bible_notes FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: bible_highlights your highlights are yours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "your highlights are yours" ON public.bible_highlights FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: prayer_list_items your list is yours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "your list is yours" ON public.prayer_list_items FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: bible_notes your notes are yours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "your notes are yours" ON public.bible_notes FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: posts your own always, everyone else's if visible to you; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "your own always, everyone else's if visible to you" ON public.posts FOR SELECT TO authenticated USING (((author_id = ( SELECT auth.uid() AS uid)) OR ((hidden_at IS NULL) AND (held_at IS NULL) AND (NOT public.has_blocked(author_id)) AND ((group_id IS NULL) OR public.is_group_member(group_id)))));


--
-- Name: testimonies yours always, your circles' when they chose so; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "yours always, your circles' when they chose so" ON public.testimonies FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ((NOT public.has_blocked(user_id)) AND ((visibility = 'public'::public.testimony_visibility) OR ((visibility = 'circles'::public.testimony_visibility) AND public.shares_a_circle_with(user_id))))));


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects anyone can look at an avatar; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "anyone can look at an avatar" ON storage.objects FOR SELECT USING ((bucket_id = 'avatars'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: iceberg_namespaces; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_namespaces ENABLE ROW LEVEL SECURITY;

--
-- Name: iceberg_tables; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: objects you delete only your own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "you delete only your own" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));


--
-- Name: objects you replace only your own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "you replace only your own" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))) WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));


--
-- Name: objects you upload only into your own folder; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "you upload only into your own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));


--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime comments; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.comments;


--
-- Name: supabase_realtime intercessions; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.intercessions;


--
-- Name: supabase_realtime messages; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.messages;


--
-- Name: supabase_realtime notifications; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.notifications;


--
-- Name: supabase_realtime post_prayers; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.post_prayers;


--
-- Name: supabase_realtime posts; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.posts;


--
-- Name: supabase_realtime prayer_plans; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.prayer_plans;


--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- Name: SCHEMA net; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA net TO supabase_functions_admin;
GRANT USAGE ON SCHEMA net TO postgres;
GRANT USAGE ON SCHEMA net TO anon;
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT USAGE ON SCHEMA net TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA realtime TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO authenticated;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- Name: SCHEMA supabase_functions; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA supabase_functions TO postgres;
GRANT USAGE ON SCHEMA supabase_functions TO anon;
GRANT USAGE ON SCHEMA supabase_functions TO authenticated;
GRANT USAGE ON SCHEMA supabase_functions TO service_role;
GRANT ALL ON SCHEMA supabase_functions TO supabase_functions_admin;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: -
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION unaccent(text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.unaccent(text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION unaccent(regdictionary, text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.unaccent(regdictionary, text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION unaccent_init(internal); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.unaccent_init(internal) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION unaccent_lexize(internal, internal, internal, internal); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.unaccent_lexize(internal, internal, internal, internal) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: -
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer); Type: ACL; Schema: net; Owner: -
--

REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin;
GRANT ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO postgres;
GRANT ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO anon;
GRANT ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO authenticated;
GRANT ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO service_role;


--
-- Name: FUNCTION http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer); Type: ACL; Schema: net; Owner: -
--

REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin;
GRANT ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO postgres;
GRANT ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO anon;
GRANT ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO authenticated;
GRANT ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO service_role;


--
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: -
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: -
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- Name: FUNCTION accept_terms(p_version text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_terms(p_version text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_terms(p_version text) TO authenticated;


--
-- Name: FUNCTION acknowledge_crisis(p_id uuid, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acknowledge_crisis(p_id uuid, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acknowledge_crisis(p_id uuid, p_note text) TO authenticated;


--
-- Name: FUNCTION admin_set_flag(p_key text, p_enabled boolean, p_actor text, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_flag(p_key text, p_enabled boolean, p_actor text, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_flag(p_key text, p_enabled boolean, p_actor text, p_reason text) TO service_role;


--
-- Name: FUNCTION admin_set_staff(p_user_id uuid, p_make_staff boolean, p_actor text, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_staff(p_user_id uuid, p_make_staff boolean, p_actor text, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_staff(p_user_id uuid, p_make_staff boolean, p_actor text, p_reason text) TO service_role;


--
-- Name: FUNCTION archive_my_plan(p_plan_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.archive_my_plan(p_plan_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.archive_my_plan(p_plan_id uuid) TO authenticated;


--
-- Name: FUNCTION blocked_either_way(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.blocked_either_way(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.blocked_either_way(p_user_id uuid) TO authenticated;


--
-- Name: FUNCTION can_create_circle_plan(p_group_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_create_circle_plan(p_group_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_create_circle_plan(p_group_id uuid) TO authenticated;


--
-- Name: FUNCTION can_pray_plan(pid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_pray_plan(pid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_pray_plan(pid uuid) TO authenticated;


--
-- Name: FUNCTION can_pray_plan_day(did uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_pray_plan_day(did uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_pray_plan_day(did uuid) TO authenticated;


--
-- Name: FUNCTION can_read_plan(pid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_plan(pid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_plan(pid uuid) TO authenticated;


--
-- Name: FUNCTION can_read_plan_day(did uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_plan_day(did uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_plan_day(did uuid) TO authenticated;


--
-- Name: FUNCTION can_read_post(pid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_post(pid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_post(pid uuid) TO authenticated;


--
-- Name: FUNCTION circle_conversation(p_group_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.circle_conversation(p_group_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.circle_conversation(p_group_id uuid) TO authenticated;


--
-- Name: FUNCTION circle_invite_token(p_group_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.circle_invite_token(p_group_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.circle_invite_token(p_group_id uuid) TO authenticated;


--
-- Name: FUNCTION circle_messages(p_group_id uuid, p_before timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.circle_messages(p_group_id uuid, p_before timestamp with time zone, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.circle_messages(p_group_id uuid, p_before timestamp with time zone, p_limit integer) TO authenticated;


--
-- Name: FUNCTION circle_plan(p_group_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.circle_plan(p_group_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.circle_plan(p_group_id uuid) TO authenticated;


--
-- Name: FUNCTION circle_shared_plans(p_group_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.circle_shared_plans(p_group_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.circle_shared_plans(p_group_id uuid) TO authenticated;


--
-- Name: FUNCTION claim_generation_chunk(p_plan_id uuid, p_request_id uuid, p_lease_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_generation_chunk(p_plan_id uuid, p_request_id uuid, p_lease_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_generation_chunk(p_plan_id uuid, p_request_id uuid, p_lease_seconds integer) TO authenticated;


--
-- Name: FUNCTION claim_hold(p_hold_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_hold(p_hold_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_hold(p_hold_id uuid) TO authenticated;


--
-- Name: FUNCTION claim_push_outbox_batch(p_limit integer, p_lease_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_push_outbox_batch(p_limit integer, p_lease_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_push_outbox_batch(p_limit integer, p_lease_seconds integer) TO service_role;


--
-- Name: FUNCTION complete_generation_chunk(p_lease_id uuid, p_days jsonb, p_title text, p_theme text, p_source_prompt jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_generation_chunk(p_lease_id uuid, p_days jsonb, p_title text, p_theme text, p_source_prompt jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_generation_chunk(p_lease_id uuid, p_days jsonb, p_title text, p_theme text, p_source_prompt jsonb) TO authenticated;


--
-- Name: FUNCTION complete_onboarding(p_display_name text, p_answers jsonb, p_timezone text, p_reminder_hours smallint[], p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_onboarding(p_display_name text, p_answers jsonb, p_timezone text, p_reminder_hours smallint[], p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_onboarding(p_display_name text, p_answers jsonb, p_timezone text, p_reminder_hours smallint[], p_locale text) TO authenticated;


--
-- Name: FUNCTION crisis_queue(p_before timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crisis_queue(p_before timestamp with time zone, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.crisis_queue(p_before timestamp with time zone, p_limit integer) TO authenticated;


--
-- Name: FUNCTION delete_my_account(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_my_account() TO authenticated;


--
-- Name: FUNCTION ensure_follow(p_follower uuid, p_followee uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.ensure_follow(p_follower uuid, p_followee uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ensure_follow(p_follower uuid, p_followee uuid) TO service_role;


--
-- Name: FUNCTION export_my_data(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.export_my_data() FROM PUBLIC;
GRANT ALL ON FUNCTION public.export_my_data() TO authenticated;


--
-- Name: FUNCTION fail_generation_chunk(p_lease_id uuid, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fail_generation_chunk(p_lease_id uuid, p_error text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fail_generation_chunk(p_lease_id uuid, p_error text) TO authenticated;


--
-- Name: FUNCTION flag_enabled(p_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.flag_enabled(p_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.flag_enabled(p_key text) TO authenticated;
GRANT ALL ON FUNCTION public.flag_enabled(p_key text) TO service_role;


--
-- Name: FUNCTION get_circle_invite_preview(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_circle_invite_preview(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_circle_invite_preview(p_token text) TO anon;
GRANT ALL ON FUNCTION public.get_circle_invite_preview(p_token text) TO authenticated;


--
-- Name: FUNCTION get_invite_preview(p_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_invite_preview(p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_invite_preview(p_code text) TO anon;
GRANT ALL ON FUNCTION public.get_invite_preview(p_code text) TO authenticated;


--
-- Name: FUNCTION get_my_day(p_plan_id uuid, p_day_number smallint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_day(p_plan_id uuid, p_day_number smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_day(p_plan_id uuid, p_day_number smallint) TO authenticated;


--
-- Name: FUNCTION get_public_plan_day(p_plan_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_public_plan_day(p_plan_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_public_plan_day(p_plan_id uuid) TO authenticated;


--
-- Name: FUNCTION get_shared_plan_day(p_plan_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_shared_plan_day(p_plan_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_shared_plan_day(p_plan_id uuid) TO authenticated;


--
-- Name: FUNCTION get_shared_plan_preview(p_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_shared_plan_preview(p_token text) TO anon;
GRANT ALL ON FUNCTION public.get_shared_plan_preview(p_token text) TO authenticated;


--
-- Name: FUNCTION has_blocked(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_blocked(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_blocked(p_user_id uuid) TO authenticated;


--
-- Name: FUNCTION has_plan_share(pid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_plan_share(pid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_plan_share(pid uuid) TO authenticated;


--
-- Name: FUNCTION held_content_queue(p_statuses text[], p_before timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.held_content_queue(p_statuses text[], p_before timestamp with time zone, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.held_content_queue(p_statuses text[], p_before timestamp with time zone, p_limit integer) TO authenticated;


--
-- Name: FUNCTION held_content_queue_page(p_statuses text[], p_after timestamp with time zone, p_limit integer, p_after_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.held_content_queue_page(p_statuses text[], p_after timestamp with time zone, p_limit integer, p_after_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.held_content_queue_page(p_statuses text[], p_after timestamp with time zone, p_limit integer, p_after_id uuid) TO authenticated;


--
-- Name: FUNCTION hide_comment(p_comment_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hide_comment(p_comment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hide_comment(p_comment_id uuid) TO authenticated;


--
-- Name: FUNCTION hide_message(p_message_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hide_message(p_message_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hide_message(p_message_id uuid) TO authenticated;


--
-- Name: FUNCTION hide_post(p_post_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hide_post(p_post_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hide_post(p_post_id uuid) TO authenticated;


--
-- Name: FUNCTION hide_reported_content(p_report_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hide_reported_content(p_report_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hide_reported_content(p_report_id uuid) TO authenticated;


--
-- Name: FUNCTION home_feed(p_before timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.home_feed(p_before timestamp with time zone, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.home_feed(p_before timestamp with time zone, p_limit integer) TO authenticated;


--
-- Name: FUNCTION home_feed_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid, p_before_kind text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.home_feed_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid, p_before_kind text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.home_feed_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid, p_before_kind text) TO authenticated;


--
-- Name: FUNCTION is_conversation_member(cid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_conversation_member(cid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_conversation_member(cid uuid) TO authenticated;


--
-- Name: FUNCTION is_group_admin(gid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_group_admin(gid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_group_admin(gid uuid) TO authenticated;


--
-- Name: FUNCTION is_group_member(gid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_group_member(gid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_group_member(gid uuid) TO authenticated;


--
-- Name: FUNCTION is_staff(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_staff() TO authenticated;


--
-- Name: FUNCTION join_group_with_token(token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_group_with_token(token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_group_with_token(token text) TO authenticated;


--
-- Name: FUNCTION local_today(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.local_today(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.local_today(p_user uuid) TO authenticated;


--
-- Name: FUNCTION locate_reference(p_ref text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.locate_reference(p_ref text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.locate_reference(p_ref text) TO authenticated;


--
-- Name: FUNCTION mark_circle_day(p_plan_day_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_circle_day(p_plan_day_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_circle_day(p_plan_day_id uuid) TO authenticated;


--
-- Name: FUNCTION mark_conversation_read(p_group_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_conversation_read(p_group_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_conversation_read(p_group_id uuid) TO authenticated;


--
-- Name: FUNCTION mark_notifications_read(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_notifications_read() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_notifications_read() TO authenticated;


--
-- Name: FUNCTION mark_push_delivery(p_outbox_id uuid, p_status text, p_receipt_id text, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_push_delivery(p_outbox_id uuid, p_status text, p_receipt_id text, p_error text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_push_delivery(p_outbox_id uuid, p_status text, p_receipt_id text, p_error text) TO service_role;


--
-- Name: FUNCTION my_notifications(p_before timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_notifications(p_before timestamp with time zone, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_notifications(p_before timestamp with time zone, p_limit integer) TO authenticated;


--
-- Name: FUNCTION my_notifications_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_notifications_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_notifications_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid) TO authenticated;


--
-- Name: FUNCTION my_plan_days(p_plan_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_plan_days(p_plan_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_plan_days(p_plan_id uuid) TO authenticated;


--
-- Name: FUNCTION my_profile_data(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_profile_data() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_profile_data() TO authenticated;


--
-- Name: FUNCTION my_unread_counts(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_unread_counts() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_unread_counts() TO authenticated;


--
-- Name: FUNCTION my_unread_notifications(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_unread_notifications() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_unread_notifications() TO authenticated;


--
-- Name: FUNCTION open_crisis_count(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_crisis_count() FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_crisis_count() TO authenticated;


--
-- Name: FUNCTION open_crisis_queue(p_after timestamp with time zone, p_after_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_crisis_queue(p_after timestamp with time zone, p_after_id uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_crisis_queue(p_after timestamp with time zone, p_after_id uuid, p_limit integer) TO authenticated;


--
-- Name: FUNCTION open_hold_count(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_hold_count() FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_hold_count() TO authenticated;


--
-- Name: FUNCTION open_report_count(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_report_count() FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_report_count() TO authenticated;


--
-- Name: FUNCTION pending_push_outbox(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pending_push_outbox(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pending_push_outbox(p_limit integer) TO service_role;


--
-- Name: FUNCTION person_plans(p_user_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.person_plans(p_user_id uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.person_plans(p_user_id uuid, p_limit integer) TO authenticated;


--
-- Name: FUNCTION person_posts(p_user_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.person_posts(p_user_id uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.person_posts(p_user_id uuid, p_limit integer) TO authenticated;


--
-- Name: FUNCTION plan_progress(p_plan_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.plan_progress(p_plan_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.plan_progress(p_plan_id uuid) TO authenticated;


--
-- Name: FUNCTION plan_today(p_plan uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.plan_today(p_plan uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.plan_today(p_plan uuid) TO anon;
GRANT ALL ON FUNCTION public.plan_today(p_plan uuid) TO authenticated;


--
-- Name: FUNCTION plan_written_days(p_plan_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.plan_written_days(p_plan_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.plan_written_days(p_plan_id uuid) TO authenticated;


--
-- Name: FUNCTION plans_shared_with_me(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.plans_shared_with_me() FROM PUBLIC;
GRANT ALL ON FUNCTION public.plans_shared_with_me() TO authenticated;


--
-- Name: FUNCTION post_comments(p_post_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_comments(p_post_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_comments(p_post_id uuid) TO authenticated;


--
-- Name: FUNCTION prayer_feed(p_group_id uuid, p_before timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prayer_feed(p_group_id uuid, p_before timestamp with time zone, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.prayer_feed(p_group_id uuid, p_before timestamp with time zone, p_limit integer) TO authenticated;


--
-- Name: FUNCTION prayer_feed_page(p_group_id uuid, p_before timestamp with time zone, p_limit integer, p_before_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prayer_feed_page(p_group_id uuid, p_before timestamp with time zone, p_limit integer, p_before_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.prayer_feed_page(p_group_id uuid, p_before timestamp with time zone, p_limit integer, p_before_id uuid) TO authenticated;


--
-- Name: FUNCTION public_profile(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.public_profile(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.public_profile(p_user_id uuid) TO authenticated;


--
-- Name: FUNCTION redeem_invite_code(p_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.redeem_invite_code(p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.redeem_invite_code(p_code text) TO authenticated;


--
-- Name: FUNCTION redeem_share_token(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.redeem_share_token(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.redeem_share_token(p_token text) TO authenticated;


--
-- Name: FUNCTION register_push_device(p_token text, p_platform text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.register_push_device(p_token text, p_platform text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.register_push_device(p_token text, p_platform text) TO authenticated;


--
-- Name: FUNCTION release_hold(p_hold_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_hold(p_hold_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_hold(p_hold_id uuid, p_reason text) TO authenticated;


--
-- Name: FUNCTION remove_hold(p_hold_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_hold(p_hold_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_hold(p_hold_id uuid, p_reason text) TO authenticated;


--
-- Name: FUNCTION report_queue(p_status public.report_status, p_before timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.report_queue(p_status public.report_status, p_before timestamp with time zone, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_queue(p_status public.report_status, p_before timestamp with time zone, p_limit integer) TO authenticated;


--
-- Name: FUNCTION report_queue_page(p_status public.report_status, p_before timestamp with time zone, p_limit integer, p_before_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.report_queue_page(p_status public.report_status, p_before timestamp with time zone, p_limit integer, p_before_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_queue_page(p_status public.report_status, p_before timestamp with time zone, p_limit integer, p_before_id uuid) TO authenticated;


--
-- Name: FUNCTION reserve_generation(p_request_id uuid, p_scope text, p_duration_days smallint, p_group_id uuid, p_visibility text, p_source_prompt jsonb, p_circle_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reserve_generation(p_request_id uuid, p_scope text, p_duration_days smallint, p_group_id uuid, p_visibility text, p_source_prompt jsonb, p_circle_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_generation(p_request_id uuid, p_scope text, p_duration_days smallint, p_group_id uuid, p_visibility text, p_source_prompt jsonb, p_circle_ids uuid[]) TO authenticated;


--
-- Name: FUNCTION resolve_push_notification(p_outbox_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_push_notification(p_outbox_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_push_notification(p_outbox_id uuid) TO authenticated;


--
-- Name: FUNCTION resolve_report(p_report_id uuid, p_status public.report_status); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_report(p_report_id uuid, p_status public.report_status) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_report(p_report_id uuid, p_status public.report_status) TO authenticated;


--
-- Name: FUNCTION resolve_scripture(p_ref text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_scripture(p_ref text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_scripture(p_ref text) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_scripture(p_ref text) TO service_role;


--
-- Name: FUNCTION revoke_all_my_push_devices(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.revoke_all_my_push_devices() FROM PUBLIC;
GRANT ALL ON FUNCTION public.revoke_all_my_push_devices() TO authenticated;


--
-- Name: FUNCTION revoke_push_device(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.revoke_push_device(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.revoke_push_device(p_token text) TO authenticated;


--
-- Name: FUNCTION search_bible(p_query text, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_bible(p_query text, p_limit integer, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_bible(p_query text, p_limit integer, p_offset integer) TO authenticated;


--
-- Name: FUNCTION search_people(p_query text, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_people(p_query text, p_limit integer, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_people(p_query text, p_limit integer, p_offset integer) TO authenticated;


--
-- Name: FUNCTION search_public_circles(p_query text, p_limit integer, p_offset integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_public_circles(p_query text, p_limit integer, p_offset integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_public_circles(p_query text, p_limit integer, p_offset integer) TO authenticated;


--
-- Name: FUNCTION settle_generation_chunk(p_lease_id uuid, p_outcome text, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_generation_chunk(p_lease_id uuid, p_outcome text, p_error text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_generation_chunk(p_lease_id uuid, p_outcome text, p_error text) TO authenticated;


--
-- Name: FUNCTION shares_a_circle_with(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.shares_a_circle_with(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.shares_a_circle_with(p_user uuid) TO authenticated;


--
-- Name: FUNCTION valid_timezone(tz text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.valid_timezone(tz text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.valid_timezone(tz text) TO authenticated;


--
-- Name: FUNCTION verse_of_the_day(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.verse_of_the_day() FROM PUBLIC;
GRANT ALL ON FUNCTION public.verse_of_the_day() TO authenticated;


--
-- Name: FUNCTION visible_testimonies(p_before timestamp with time zone, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.visible_testimonies(p_before timestamp with time zone, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.visible_testimonies(p_before timestamp with time zone, p_limit integer) TO authenticated;


--
-- Name: FUNCTION visible_testimonies_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.visible_testimonies_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.visible_testimonies_page(p_before timestamp with time zone, p_limit integer, p_before_id uuid) TO authenticated;


--
-- Name: FUNCTION who_prayed_for_me(p_since date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.who_prayed_for_me(p_since date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.who_prayed_for_me(p_since date) TO authenticated;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO service_role;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION send_binary(payload bytea, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION wal2json_escape_identifier(name text); Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON FUNCTION realtime.wal2json_escape_identifier(name text) TO postgres;
GRANT ALL ON FUNCTION realtime.wal2json_escape_identifier(name text) TO dashboard_user;


--
-- Name: FUNCTION http_request(); Type: ACL; Schema: supabase_functions; Owner: -
--

REVOKE ALL ON FUNCTION supabase_functions.http_request() FROM PUBLIC;
GRANT ALL ON FUNCTION supabase_functions.http_request() TO postgres;
GRANT ALL ON FUNCTION supabase_functions.http_request() TO anon;
GRANT ALL ON FUNCTION supabase_functions.http_request() TO authenticated;
GRANT ALL ON FUNCTION supabase_functions.http_request() TO service_role;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: -
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: -
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: -
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE custom_oauth_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.custom_oauth_providers TO postgres;
GRANT ALL ON TABLE auth.custom_oauth_providers TO dashboard_user;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: -
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE webauthn_challenges; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.webauthn_challenges TO postgres;
GRANT ALL ON TABLE auth.webauthn_challenges TO dashboard_user;


--
-- Name: TABLE webauthn_credentials; Type: ACL; Schema: auth; Owner: -
--

GRANT ALL ON TABLE auth.webauthn_credentials TO postgres;
GRANT ALL ON TABLE auth.webauthn_credentials TO dashboard_user;


--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;


--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: -
--

GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;


--
-- Name: TABLE bible_book_aliases; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_book_aliases TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_book_aliases TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_book_aliases TO service_role;


--
-- Name: TABLE bible_books; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_books TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_books TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_books TO service_role;


--
-- Name: TABLE bible_highlights; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_highlights TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_highlights TO authenticated;
GRANT ALL ON TABLE public.bible_highlights TO service_role;


--
-- Name: TABLE bible_notes; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_notes TO anon;
GRANT ALL ON TABLE public.bible_notes TO authenticated;
GRANT ALL ON TABLE public.bible_notes TO service_role;


--
-- Name: TABLE bible_verses; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_verses TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_verses TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.bible_verses TO service_role;


--
-- Name: TABLE blocks; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.blocks TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.blocks TO authenticated;
GRANT ALL ON TABLE public.blocks TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comments TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comments TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.comments TO service_role;


--
-- Name: TABLE conversation_members; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversation_members TO anon;
GRANT ALL ON TABLE public.conversation_members TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversation_members TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversations TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversations TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversations TO service_role;


--
-- Name: TABLE daily_verses; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.daily_verses TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.daily_verses TO authenticated;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.daily_verses TO service_role;


--
-- Name: TABLE feature_flag_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.feature_flag_events TO service_role;


--
-- Name: TABLE feature_flags; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.feature_flags TO service_role;


--
-- Name: TABLE follows; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.follows TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.follows TO authenticated;
GRANT ALL ON TABLE public.follows TO service_role;


--
-- Name: TABLE generation_ledger; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.generation_ledger TO authenticated;
GRANT SELECT ON TABLE public.generation_ledger TO service_role;


--
-- Name: TABLE group_members; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.group_members TO anon;
GRANT ALL ON TABLE public.group_members TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.group_members TO service_role;


--
-- Name: TABLE group_prayer_days; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.group_prayer_days TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.group_prayer_days TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.group_prayer_days TO service_role;


--
-- Name: TABLE groups; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.groups TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.groups TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.groups TO service_role;


--
-- Name: COLUMN groups.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.owner_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(owner_id) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(name) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.description; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(description) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(avatar_url) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.visibility; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(visibility) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.member_count; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(member_count) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.streak_count; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(streak_count) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.streak_last_day; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(streak_last_day) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.groups TO authenticated;


--
-- Name: COLUMN groups.search_vector; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(search_vector) ON TABLE public.groups TO authenticated;


--
-- Name: TABLE intercessions; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.intercessions TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.intercessions TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.intercessions TO service_role;


--
-- Name: COLUMN intercessions.message_hidden_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(message_hidden_at) ON TABLE public.intercessions TO authenticated;


--
-- Name: TABLE invites; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.invites TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.invites TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.invites TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.messages TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.messages TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.messages TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notifications TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.notifications TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notifications TO service_role;


--
-- Name: TABLE plan_generation_leases; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.plan_generation_leases TO service_role;


--
-- Name: TABLE plan_shares; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.plan_shares TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.plan_shares TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.plan_shares TO service_role;


--
-- Name: TABLE plus_waitlist; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.plus_waitlist TO authenticated;
GRANT ALL ON TABLE public.plus_waitlist TO service_role;


--
-- Name: TABLE post_prayers; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.post_prayers TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.post_prayers TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.post_prayers TO service_role;


--
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.posts TO anon;
GRANT ALL ON TABLE public.posts TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.posts TO service_role;


--
-- Name: TABLE prayer_list_items; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_list_items TO anon;
GRANT ALL ON TABLE public.prayer_list_items TO authenticated;
GRANT ALL ON TABLE public.prayer_list_items TO service_role;


--
-- Name: TABLE prayer_logs; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_logs TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_logs TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_logs TO service_role;


--
-- Name: TABLE prayer_plan_days; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_plan_days TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_plan_days TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_plan_days TO service_role;


--
-- Name: COLUMN prayer_plan_days.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: COLUMN prayer_plan_days.plan_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(plan_id) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: COLUMN prayer_plan_days.day_number; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(day_number) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: COLUMN prayer_plan_days.title; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(title) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: COLUMN prayer_plan_days.scripture_ref; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(scripture_ref) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: COLUMN prayer_plan_days.scripture_text; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(scripture_text) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: COLUMN prayer_plan_days.unlock_date; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(unlock_date) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: COLUMN prayer_plan_days.intercession_count; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(intercession_count) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: COLUMN prayer_plan_days.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: COLUMN prayer_plan_days.intercessor_prayer; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(intercessor_prayer) ON TABLE public.prayer_plan_days TO authenticated;


--
-- Name: TABLE prayer_plans; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_plans TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_plans TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.prayer_plans TO service_role;


--
-- Name: COLUMN prayer_plans.title; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(title) ON TABLE public.prayer_plans TO authenticated;


--
-- Name: COLUMN prayer_plans.visibility; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(visibility) ON TABLE public.prayer_plans TO authenticated;


--
-- Name: TABLE profile_settings; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profile_settings TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profile_settings TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profile_settings TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.display_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(display_name),UPDATE(display_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(avatar_url),UPDATE(avatar_url) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.follower_count; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(follower_count) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.following_count; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(following_count) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.search_vector; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(search_vector) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE push_devices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.push_devices TO authenticated;
GRANT SELECT ON TABLE public.push_devices TO service_role;


--
-- Name: TABLE push_outbox; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,UPDATE ON TABLE public.push_outbox TO service_role;


--
-- Name: TABLE reports; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reports TO anon;
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reports TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.reports TO service_role;


--
-- Name: TABLE share_links; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.share_links TO anon;
GRANT ALL ON TABLE public.share_links TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.share_links TO service_role;


--
-- Name: TABLE staff_admin_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.staff_admin_events TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscriptions TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscriptions TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE testimonies; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.testimonies TO anon;
GRANT ALL ON TABLE public.testimonies TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.testimonies TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages TO postgres;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE messages_2026_09_18; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2026_09_18 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_09_18 TO dashboard_user;


--
-- Name: TABLE messages_2026_09_19; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2026_09_19 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_09_19 TO dashboard_user;


--
-- Name: TABLE messages_2026_09_20; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2026_09_20 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_09_20 TO dashboard_user;


--
-- Name: TABLE messages_2026_09_21; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2026_09_21 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_09_21 TO dashboard_user;


--
-- Name: TABLE messages_2026_09_22; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2026_09_22 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_09_22 TO dashboard_user;


--
-- Name: TABLE messages_2026_09_23; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2026_09_23 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_09_23 TO dashboard_user;


--
-- Name: TABLE messages_2026_09_24; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.messages_2026_09_24 TO postgres;
GRANT ALL ON TABLE realtime.messages_2026_09_24 TO dashboard_user;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: -
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO anon;


--
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT ALL ON TABLE storage.buckets_analytics TO authenticated;
GRANT ALL ON TABLE storage.buckets_analytics TO anon;


--
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: -
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;


--
-- Name: TABLE iceberg_namespaces; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.iceberg_namespaces TO service_role;
GRANT SELECT ON TABLE storage.iceberg_namespaces TO authenticated;
GRANT SELECT ON TABLE storage.iceberg_namespaces TO anon;


--
-- Name: TABLE iceberg_tables; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.iceberg_tables TO service_role;
GRANT SELECT ON TABLE storage.iceberg_tables TO authenticated;
GRANT SELECT ON TABLE storage.iceberg_tables TO anon;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO anon;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: -
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: -
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;


--
-- Name: TABLE hooks; Type: ACL; Schema: supabase_functions; Owner: -
--

GRANT ALL ON TABLE supabase_functions.hooks TO postgres;
GRANT ALL ON TABLE supabase_functions.hooks TO anon;
GRANT ALL ON TABLE supabase_functions.hooks TO authenticated;
GRANT ALL ON TABLE supabase_functions.hooks TO service_role;


--
-- Name: SEQUENCE hooks_id_seq; Type: ACL; Schema: supabase_functions; Owner: -
--

GRANT ALL ON SEQUENCE supabase_functions.hooks_id_seq TO postgres;
GRANT ALL ON SEQUENCE supabase_functions.hooks_id_seq TO anon;
GRANT ALL ON SEQUENCE supabase_functions.hooks_id_seq TO authenticated;
GRANT ALL ON SEQUENCE supabase_functions.hooks_id_seq TO service_role;


--
-- Name: TABLE migrations; Type: ACL; Schema: supabase_functions; Owner: -
--

GRANT ALL ON TABLE supabase_functions.migrations TO postgres;
GRANT ALL ON TABLE supabase_functions.migrations TO anon;
GRANT ALL ON TABLE supabase_functions.migrations TO authenticated;
GRANT ALL ON TABLE supabase_functions.migrations TO service_role;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: -
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: -
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT UPDATE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT UPDATE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT UPDATE ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: supabase_functions; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: supabase_functions; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: supabase_functions; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA supabase_functions GRANT ALL ON TABLES TO service_role;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict GKVDpszuAbnhQnUFCENacqBijPCW9UOAcmKDqA9JFO4Wf1r3FKrtPgYrykyawlp

