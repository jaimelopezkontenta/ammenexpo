#!/usr/bin/env bash
# Concurrencia real sobre `reserve_generation` — harness manual, no parte de CI.
#
# La suite `supabase/tests/generation.sql` corre sobre UNA conexión psql y, por
# tanto, NO puede demostrar que dos reservas paralelas no se saltan el límite.
# Esa garantía la da el advisory lock por usuario dentro de `reserve_generation`,
# y ESTE harness es lo que la ejercita de verdad: lanza N reservas simultáneas
# desde conexiones independientes y afirma que solo FREE_PLAN_LIMIT (3) ganan.
#
# Requisitos: el stack local levantado (`supabase start`) y `docker` accesible.
# No forma parte de `npm run verify` ni de `db:test`: es una suite opcional
# de `scripts/dbTest.mjs`, que resetea la base antes.
#
#   npm run db:test:generation-concurrency
#   N=12 npm run db:test:generation-concurrency         # más presión
#   bash supabase/tests/generation-concurrency.sh       # sin reset ni lock
#
# Cada worker borra y recrea su usuario (id fijo, cascada limpia el ledger), así
# que el harness es re-ejecutable sin reset.
set -euo pipefail

N=${N:-8}
LIMIT=3
USER_ID="77777777-7777-7777-7777-777777777777"
DB="supabase_db_ammen"

psql_exec() {
  docker exec -i "$DB" psql -U postgres -d postgres -At -q "$@"
}

# Partir de cuota cero para este usuario.
psql_exec >/dev/null -c "delete from auth.users where id = '$USER_ID'; insert into auth.users (id, email, aud, role, raw_user_meta_data) values ('$USER_ID', 'concur@test.local', 'authenticated', 'authenticated', '{\"display_name\":\"Concur\"}');"

rm -f /tmp/ammen-reserve-*.out

for i in $(seq 1 "$N"); do
  (
    docker exec -i "$DB" psql -U postgres -d postgres -At -q \
      -c "set role authenticated; set request.jwt.claims = '{\"sub\":\"$USER_ID\",\"role\":\"authenticated\"}'; select ok from public.reserve_generation(gen_random_uuid(), 'personal', 7::smallint);" \
      > "/tmp/ammen-reserve-$i.out" 2>/dev/null
  ) &
done
wait

WON=0
for i in $(seq 1 "$N"); do
  if [ "$(cat "/tmp/ammen-reserve-$i.out")" = "t" ]; then
    WON=$((WON + 1))
  fi
done

RESERVED=$(psql_exec -c "select count(*) from public.generation_ledger where user_id = '$USER_ID' and scope in ('personal','circle');")

echo "concurrent reserve_generation calls: $N"
echo "winners:        $WON (expected $LIMIT)"
echo "ledger rows:    $RESERVED (expected $LIMIT)"

if [ "$WON" -eq "$LIMIT" ] && [ "$RESERVED" -eq "$LIMIT" ]; then
  echo "PASS: exactly $LIMIT reservations survived real concurrency"
else
  echo "FAIL: expected $LIMIT winners and $LIMIT ledger rows"
  exit 1
fi
