-- Oleada 4b (2026-09-29): el secreto que firma los enlaces de baja, a Vault.
--
-- `public.email_runtime.hmac_secret` guardaba en TEXTO PLANO el secreto con
-- el que se firman los tokens de preferencias y baja (`issue_email_prefs_token`).
-- Cualquiera con un volcado de la base, un backup o `service_role` podía leerlo
-- y fabricar el enlace de baja de cualquier cuenta. Los secretos de invocación
-- de las colas ya viven en Vault (`20260929074610_queue_scheduler`); este se
-- une a ellos como `ammen_email_hmac_secret`.
--
-- **Los enlaces ya enviados siguen valiendo.** El secreto de Vault se crea con
-- el MISMO valor que tenía la tabla: un token firmado antes de esta migración
-- verifica igual después. Rotarlo (runbook staging-web, «Secreto de los enlaces
-- de baja») sí los invalida todos, que es para lo que sirve rotar.
--
-- **Por qué una función y no un DO suelto.** `email_hmac_secret_to_vault()`
-- hace el traslado y es idempotente: esta migración la llama, `email.sql` la
-- vuelve a llamar sobre una base «de antes» para probar que un token viejo
-- sigue verificando, y si en un entorno Vault no estuviera disponible al hacer
-- el push, se puede repetir a mano cuando lo esté. Solo la ejecuta el dueño de
-- la base (ningún rol de la API).
--
-- **Migrado a medias no rompe.** Si Vault falla (permisos, extensión), el
-- traslado avisa con un WARNING y deja el secreto en la tabla;
-- `email_hmac_secret()` lee primero Vault y, solo si ahí no está, la tabla. La
-- columna solo se vacía cuando Vault ya descifra el secreto: nunca se queda la
-- base sin él por el camino.

-- La columna deja de ser obligatoria: vaciada es el estado normal a partir de
-- ahora.
alter table public.email_runtime
  alter column hmac_secret drop not null;

comment on column public.email_runtime.hmac_secret is
  'Obsoleta: el secreto HMAC de los enlaces de baja vive en Vault (ammen_email_hmac_secret). '
  'Vacía tras email_hmac_secret_to_vault(); solo se lee si Vault no tiene el secreto.';

create or replace function public.email_hmac_secret_to_vault()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_table text;
  v_vault text;
  v_created boolean := false;
begin
  select nullif(r.hmac_secret, '') into v_table
    from public.email_runtime r
   where r.id;

  begin
    if not exists (
      select 1 from vault.secrets s where s.name = 'ammen_email_hmac_secret'
    ) then
      -- Sin valor en la tabla (no debería pasar: la migración de correo lo
      -- siembra) se estrena uno: no hay enlaces viejos que conservar.
      perform vault.create_secret(
        coalesce(v_table, encode(extensions.gen_random_bytes(32), 'hex')),
        'ammen_email_hmac_secret',
        'Firma los enlaces de preferencias y baja del correo. Rotarlo invalida los ya enviados.'
      );
      v_created := true;
    end if;

    select nullif(ds.decrypted_secret, '') into v_vault
      from vault.decrypted_secrets ds
     where ds.name = 'ammen_email_hmac_secret';
  exception
    when others then
      raise warning
        'email_hmac_secret_to_vault: Vault no disponible (%); el secreto sigue en email_runtime',
        sqlerrm;
      return 'vault_unavailable';
  end;

  if v_vault is null then
    raise warning
      'email_hmac_secret_to_vault: Vault no descifra ammen_email_hmac_secret; el secreto sigue en email_runtime';
    return 'vault_unreadable';
  end if;

  -- Solo ahora, con Vault respondiendo, deja de haber una copia en claro.
  update public.email_runtime
     set hmac_secret = null,
         updated_at = now()
   where id
     and hmac_secret is not null;

  return case when v_created then 'created' else 'already_in_vault' end;
end;
$$;

revoke execute on function public.email_hmac_secret_to_vault()
  from public, anon, authenticated, service_role;

-- Vault primero; la tabla, solo si Vault no tiene el secreto. Sin ninguno de
-- los dos, null: `issue_email_prefs_token` devuelve null y
-- `verify_email_prefs_token` no acepta nada (falla cerrado).
create or replace function public.email_hmac_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select nullif(ds.decrypted_secret, '')
       from vault.decrypted_secrets ds
      where ds.name = 'ammen_email_hmac_secret'
      limit 1),
    (select nullif(r.hmac_secret, '')
       from public.email_runtime r
      where r.id)
  );
$$;

revoke execute on function public.email_hmac_secret() from public, anon, authenticated;
grant execute on function public.email_hmac_secret() to service_role;

select public.email_hmac_secret_to_vault();
