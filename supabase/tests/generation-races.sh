#!/usr/bin/env bash
# Carreras de escritura sobre el ledger IA — harness manual, no parte de CI.
#
# La suite `supabase/tests/generation.sql` corre sobre UNA conexión psql y NO
# puede demostrar que claim/complete/settle/fail sobre el MISMO plan no se
# intercalan. Esa garantía la da el advisory lock por plan (hashtextextended)
# que ahora adquieren las CUATRO operaciones ANTES de re-leer el lease. ESTE
# harness es lo que lo ejercita de verdad, con conexiones independientes:
#
#   1. complete × claim  — un complete con lease vivo corre contra un claim
#      (request distinto) del mismo plan. Invariante: los días se escriben UNA
#      vez y el ledger de continuation queda UNA fila para ese request.
#   2. claim × third-fail — un fail que agota el tercer reintento del primer
#      tramo corre contra un claim. Invariante: el plan queda `failed` y no
#      sobrevive ningún lease huérfano, con exactamente 3 filas `failed` en el
#      primer tramo.
#   3. complete × reclaim — el worker viejo intenta completar un lease vencido
#      mientras otro request lo reclama. Invariante: el viejo no escribe días ni
#      ledger y el lease nuevo sobrevive.
#
# Requisitos: el stack local levantado (`supabase start`) y `docker` accesible.
# No forma parte de `npm run verify` ni de `db:test`.
#
#   bash supabase/tests/generation-races.sh
#   R=20 bash supabase/tests/generation-races.sh   # más iteraciones
#
# Cada worker borra y recrea sus usuarios (id fijo, cascada limpia el ledger),
# así que el harness es re-ejecutable sin reset.
set -euo pipefail

R=${R:-12}
DB="supabase_db_ammen"

USER_A="66666666-6666-6666-6666-666666666666"  # complete×claim
USER_B="77777777-7777-7777-7777-777777777778"  # claim×third-fail (id fijo, distinto del reserve)
USER_C="88888888-8888-8888-8888-888888888888"  # complete×reclaim

psql_exec() {
  docker exec -i "$DB" psql -U postgres -d postgres -At -q "$@"
}

new_uuid() {
  psql_exec -c "select gen_random_uuid();"
}

as_user() { # $1 user_id, $2 sql
  echo "set role authenticated; set request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\"}'; $2"
}

# ---------------------------------------------------------------------------
# Carrera 1: complete × claim sobre el MISMO plan
# ---------------------------------------------------------------------------
run_complete_claim_race() {
  local PLAN REQ_A LEASE_A REQ_B

  psql_exec >/dev/null -c "delete from auth.users where id = '$USER_A'; insert into auth.users (id, email, aud, role, raw_user_meta_data) values ('$USER_A', 'raceA@test.local', 'authenticated', 'authenticated', '{\"display_name\":\"RaceA\"}');"

  REQ_A=$(new_uuid)
  PLAN=$(psql_exec -c "$(as_user "$USER_A" "select plan_id::text from public.reserve_generation(gen_random_uuid(), 'personal', 14::smallint);")")
  LEASE_A=$(psql_exec -c "$(as_user "$USER_A" "select lease_id::text from public.claim_generation_chunk('$PLAN', '$REQ_A');")")
  REQ_B=$(new_uuid)

  DAYS_JSON='[{"day_number":1,"title":"Día 1","prayer_body":"Oración","unlock_date":"2026-01-01"},{"day_number":2,"title":"Día 2","prayer_body":"Oración","unlock_date":"2026-01-02"},{"day_number":3,"title":"Día 3","prayer_body":"Oración","unlock_date":"2026-01-03"},{"day_number":4,"title":"Día 4","prayer_body":"Oración","unlock_date":"2026-01-04"},{"day_number":5,"title":"Día 5","prayer_body":"Oración","unlock_date":"2026-01-05"},{"day_number":6,"title":"Día 6","prayer_body":"Oración","unlock_date":"2026-01-06"},{"day_number":7,"title":"Día 7","prayer_body":"Oración","unlock_date":"2026-01-07"}]'

  # Dos conexiones independientes, a la vez.
  docker exec -i "$DB" psql -U postgres -d postgres -At -q \
    -c "$(as_user "$USER_A" "select ok || '|' || reason from public.complete_generation_chunk('$LEASE_A', '$DAYS_JSON'::jsonb, 'Título', null, null);")" \
    >/tmp/ammen-raceA-complete.out 2>/dev/null &
  docker exec -i "$DB" psql -U postgres -d postgres -At -q \
    -c "$(as_user "$USER_A" "select reason || '|' || coalesce(lease_id::text,'') || '|' || coalesce(from_day::text,'') from public.claim_generation_chunk('$PLAN', '$REQ_B');")" \
    >/tmp/ammen-raceA-claim.out 2>/dev/null &
  wait

  local DAYS CONT
  DAYS=$(psql_exec -c "select count(*) from public.prayer_plan_days where plan_id = '$PLAN';")
  CONT=$(psql_exec -c "select count(*) from public.generation_ledger where request_id = '$REQ_A' and scope = 'continuation' and status = 'completed';")

  if [ "$DAYS" -ne 7 ] || [ "$CONT" -ne 1 ]; then
    echo "FAIL  complete×claim: days=$DAYS (expected 7), continuation rows=$CONT (expected 1)"
    echo "      complete: $(cat /tmp/ammen-raceA-complete.out)  claim: $(cat /tmp/ammen-raceA-claim.out)"
    return 1
  fi

  psql_exec >/dev/null -c "delete from auth.users where id = '$USER_A';"
  return 0
}

# ---------------------------------------------------------------------------
# Carrera 2: claim × third-fail (el fail que agota el primer tramo)
# ---------------------------------------------------------------------------
run_claim_fail_race() {
  local PLAN REQ1 REQ2 REQ3 REQ_W LEASE1 LEASE2

  psql_exec >/dev/null -c "delete from auth.users where id = '$USER_B'; insert into auth.users (id, email, aud, role, raw_user_meta_data) values ('$USER_B', 'raceB@test.local', 'authenticated', 'authenticated', '{\"display_name\":\"RaceB\"}');"

  PLAN=$(psql_exec -c "$(as_user "$USER_B" "select plan_id::text from public.reserve_generation(gen_random_uuid(), 'personal', 7::smallint);")")

  # Dos fallos previos (retry, no plan_failed).
  REQ1=$(new_uuid)
  LEASE1=$(psql_exec -c "$(as_user "$USER_B" "select lease_id::text from public.claim_generation_chunk('$PLAN', '$REQ1');")")
  psql_exec >/dev/null -c "$(as_user "$USER_B" "select * from public.fail_generation_chunk('$LEASE1', 'generation_failed');")"

  REQ2=$(new_uuid)
  LEASE2=$(psql_exec -c "$(as_user "$USER_B" "select lease_id::text from public.claim_generation_chunk('$PLAN', '$REQ2');")")
  psql_exec >/dev/null -c "$(as_user "$USER_B" "select * from public.fail_generation_chunk('$LEASE2', 'generation_failed');")"

  # Tercer tramo reclamado (nuevo lease vivo).
  REQ3=$(new_uuid)
  local LEASE3
  LEASE3=$(psql_exec -c "$(as_user "$USER_B" "select lease_id::text from public.claim_generation_chunk('$PLAN', '$REQ3');")")
  REQ_W=$(new_uuid)

  # Dos conexiones: el tercer fail (marcará failed) vs un claim concurrente.
  docker exec -i "$DB" psql -U postgres -d postgres -At -q \
    -c "$(as_user "$USER_B" "select ok || '|' || plan_failed || '|' || retry from public.fail_generation_chunk('$LEASE3', 'generation_failed');")" \
    >/tmp/ammen-raceB-fail.out 2>/dev/null &
  docker exec -i "$DB" psql -U postgres -d postgres -At -q \
    -c "$(as_user "$USER_B" "select reason || '|' || coalesce(lease_id::text,'') || '|' || coalesce(from_day::text,'') from public.claim_generation_chunk('$PLAN', '$REQ_W');")" \
    >/tmp/ammen-raceB-claim.out 2>/dev/null &
  wait

  local STATUS FAILS LEASES
  STATUS=$(psql_exec -c "select status from public.prayer_plans where id = '$PLAN';")
  FAILS=$(psql_exec -c "select count(*) from public.generation_ledger where plan_id = '$PLAN' and scope = 'continuation' and from_day = 1 and status = 'failed';")
  LEASES=$(psql_exec -c "select count(*) from public.plan_generation_leases where plan_id = '$PLAN';")

  if [ "$STATUS" != "failed" ] || [ "$FAILS" -ne 3 ] || [ "$LEASES" -ne 0 ]; then
    echo "FAIL  claim×third-fail: status=$STATUS (expected failed), first-stretch failures=$FAILS (expected 3), leases=$LEASES (expected 0)"
    echo "      fail: $(cat /tmp/ammen-raceB-fail.out)  claim: $(cat /tmp/ammen-raceB-claim.out)"
    return 1
  fi

  psql_exec >/dev/null -c "delete from auth.users where id = '$USER_B';"
  return 0
}

# ---------------------------------------------------------------------------
# Carrera 3: complete del worker viejo × reclaim tras lease vencido
# ---------------------------------------------------------------------------
run_complete_reclaim_race() {
  local PLAN OLD_REQUEST NEW_REQUEST OLD_LEASE

  psql_exec >/dev/null -c "delete from auth.users where id = '$USER_C'; insert into auth.users (id, email, aud, role, raw_user_meta_data) values ('$USER_C', 'raceC@test.local', 'authenticated', 'authenticated', '{\"display_name\":\"RaceC\"}');"

  PLAN=$(psql_exec -c "$(as_user "$USER_C" "select plan_id::text from public.reserve_generation(gen_random_uuid(), 'personal', 7::smallint);")")
  OLD_REQUEST=$(new_uuid)
  OLD_LEASE=$(psql_exec -c "$(as_user "$USER_C" "select lease_id::text from public.claim_generation_chunk('$PLAN', '$OLD_REQUEST');")")

  # The worker has died: leave its row in place, but make its token invalid.
  psql_exec >/dev/null -c "update public.plan_generation_leases set leased_until = now() - interval '1 second' where plan_id = '$PLAN';"
  NEW_REQUEST=$(new_uuid)

  DAYS_JSON='[{"day_number":1,"title":"Día 1","prayer_body":"Oración","unlock_date":"2026-01-01"}]'

  docker exec -i "$DB" psql -U postgres -d postgres -At -q \
    -c "$(as_user "$USER_C" "select ok || '|' || reason from public.complete_generation_chunk('$OLD_LEASE', '$DAYS_JSON'::jsonb, 'Título', null, null);")" \
    >/tmp/ammen-raceC-complete.out 2>/dev/null &
  docker exec -i "$DB" psql -U postgres -d postgres -At -q \
    -c "$(as_user "$USER_C" "select reason || '|' || coalesce(lease_id::text,'') from public.claim_generation_chunk('$PLAN', '$NEW_REQUEST');")" \
    >/tmp/ammen-raceC-reclaim.out 2>/dev/null &
  wait

  local DAYS OLD_LEDGER NEW_LEASES
  DAYS=$(psql_exec -c "select count(*) from public.prayer_plan_days where plan_id = '$PLAN';")
  OLD_LEDGER=$(psql_exec -c "select count(*) from public.generation_ledger where request_id = '$OLD_REQUEST' and scope = 'continuation';")
  NEW_LEASES=$(psql_exec -c "select count(*) from public.plan_generation_leases where plan_id = '$PLAN' and request_id = '$NEW_REQUEST' and leased_until > now();")

  if [ "$DAYS" -ne 0 ] || [ "$OLD_LEDGER" -ne 0 ] || [ "$NEW_LEASES" -ne 1 ]; then
    echo "FAIL  complete×reclaim: days=$DAYS (expected 0), old ledger=$OLD_LEDGER (expected 0), new live leases=$NEW_LEASES (expected 1)"
    echo "      old complete: $(cat /tmp/ammen-raceC-complete.out)  reclaim: $(cat /tmp/ammen-raceC-reclaim.out)"
    return 1
  fi

  psql_exec >/dev/null -c "delete from auth.users where id = '$USER_C';"
  return 0
}

# ---------------------------------------------------------------------------
# Ejecutar
# ---------------------------------------------------------------------------
FAILURES=0

for n in $(seq 1 "$R"); do
  if ! run_complete_claim_race; then
    FAILURES=$((FAILURES + 1))
  fi
  if ! run_claim_fail_race; then
    FAILURES=$((FAILURES + 1))
  fi
  if ! run_complete_reclaim_race; then
    FAILURES=$((FAILURES + 1))
  fi
done

echo "races run: $((R * 3)) (complete×claim + claim×third-fail + complete×reclaim)"
if [ "$FAILURES" -eq 0 ]; then
  echo "PASS: no double days, no double ledger continuation, no stale-worker writes"
else
  echo "FAIL: $FAILURES invariant violations across $R iterations"
  exit 1
fi
