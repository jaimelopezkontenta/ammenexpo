-- Revisión adversarial R1 (2026-09-29), S3: encender el programador no puede
-- vaciar de golpe meses de cola.
--
-- Push se encola desde el 2026-08-23 y el correo desde el 2026-09-08, y nada
-- lo drenaba. El primer minuto con `scheduler_settings.enabled = true` saldría
-- todo: bienvenidas de hace semanas, avisos de oraciones de agosto, digests
-- de días que ya pasaron. `skip_stale_queue_rows` marca `skipped` (motivo
-- `stale`) lo pendiente más viejo que el umbral que se le pase, y el runbook
-- lo corre justo antes de encender. Nada se borra: queda el rastro de qué no
-- salió y por qué.
--
-- En correo cuenta la fecha más tardía entre alta y programación: una fila
-- programada para mañana no está atrasada aunque se creara hace un mes. Lo
-- que tiene el lease vivo lo está enviando alguien ahora mismo: no se toca.

create or replace function public.skip_stale_queue_rows(p_older_than interval)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email integer;
  v_push integer;
begin
  if p_older_than is null or p_older_than <= interval '0' then
    raise exception 'skip_stale_queue_rows needs a positive interval';
  end if;

  update public.email_outbox o
     set status = 'skipped',
         last_error = 'stale',
         leased_until = null
   where o.status = 'pending'
     and greatest(o.created_at, o.scheduled_for) < now() - p_older_than
     and (o.leased_until is null or o.leased_until < now());
  get diagnostics v_email = row_count;

  update public.push_outbox o
     set status = 'skipped',
         last_error = 'stale',
         leased_until = null
   where o.status = 'pending'
     and o.created_at < now() - p_older_than
     and (o.leased_until is null or o.leased_until < now());
  get diagnostics v_push = row_count;

  return jsonb_build_object('email_outbox', v_email, 'push_outbox', v_push);
end;
$$;

revoke execute on function public.skip_stale_queue_rows(interval) from public, anon, authenticated;
grant execute on function public.skip_stale_queue_rows(interval) to service_role;
