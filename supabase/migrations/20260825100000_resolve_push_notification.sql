-- Ammen — B4 corrección: resolver el destino de un tap de push en el servidor.
--
-- **El agujero.** El payload de `send-intercession-push` ya era mínimo y
-- opaco (`{ type: 'intercession', outboxId }`, nunca un `planId` ni texto) —
-- pero el cliente no tenía ninguna forma de comprobar, al recibir el tap,
-- que ese `outboxId` siguiera siendo suyo de verdad antes de navegar a
-- ninguna parte. Un payload no es de confiar solo porque llegó por el canal
-- de push: pudo quedar cacheado en el sistema operativo desde antes de un
-- bloqueo, una revocación de sesión o un cambio de cuenta en el mismo
-- dispositivo.
--
-- **La corrección.** `resolve_push_notification()` es la única fuente de
-- verdad sobre si ese aviso todavía autoriza algo para quien lo abre: exige
-- que el outbox exista, que la intercesión asociada tenga como dueño a quien
-- pregunta (`auth.uid()`), y que el dueño no haya bloqueado a quien oró
-- desde entonces. El cliente nunca decide esto por su cuenta ni confía en
-- ningún campo del payload más allá del id de la fila.

create function public.resolve_push_notification(p_outbox_id uuid)
returns table (
  authorized boolean,
  intercessor_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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

revoke execute on function public.resolve_push_notification(uuid) from public;
grant execute on function public.resolve_push_notification(uuid) to authenticated;
