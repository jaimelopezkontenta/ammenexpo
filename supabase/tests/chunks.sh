#!/usr/bin/env bash
# Exercises the chunk orchestration without depending on model quality.
#
# Requires the local stack and `npx supabase functions serve` to be running.
# Run with: npm run db:test:chunks (optional suite of scripts/dbTest.mjs,
# which resets the database first; not part of db:test or verify).
set -euo pipefail

API="http://127.0.0.1:54421"
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
PSQL=(docker exec -i supabase_db_ammen psql -U postgres -d postgres -At)

mk_user() {
  local email="$1"
  curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"oracion2026\"}"
}

field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(r$1 ?? '')})"; }

OUT=$(mk_user "chunks+$(date +%s)@test.local")
TOKEN=$(echo "$OUT" | field ".access_token")
OWNER=$(echo "$OUT" | field ".user.id")

OUT2=$(mk_user "other+$(date +%s)@test.local")
TOKEN2=$(echo "$OUT2" | field ".access_token")

echo "1. Sembrando un plan de 14 días con 7 ya escritos"
"${PSQL[@]}" >/dev/null <<SQL
insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, status, source_prompt)
values ('cccc0000-0000-0000-0000-000000000001', '$OWNER', 'Plan por tramos', 14,
        current_date, 'private', 'active', '{"answers":{"season":"anxiety","topics":["peace"]}}'::jsonb);
insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body, unlock_date)
select 'cccc0000-0000-0000-0000-000000000001', n, 'Día ' || n, 'Oración', current_date + (n-1)
from generate_series(1,7) n;
SQL

echo "2. Continuación: debe pedir los días 8 a 14"
curl -s -X POST "$API/functions/v1/generate-prayer-plan" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"continue_plan_id":"cccc0000-0000-0000-0000-000000000001"}' | tee /tmp/chunk1.json
echo

echo "3. Otro usuario intentando continuar el plan ajeno (debe ser 404)"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" -X POST "$API/functions/v1/generate-prayer-plan" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"continue_plan_id":"cccc0000-0000-0000-0000-000000000001"}'

echo "4. Plan ya completo: no debe generar más"
"${PSQL[@]}" >/dev/null <<SQL
insert into public.prayer_plans (id, owner_id, title, duration_days, start_date, visibility, status)
values ('cccc0000-0000-0000-0000-000000000002', '$OWNER', 'Plan completo', 3,
        current_date, 'private', 'active');
insert into public.prayer_plan_days (plan_id, day_number, title, prayer_body, unlock_date)
select 'cccc0000-0000-0000-0000-000000000002', n, 'Día ' || n, 'Oración', current_date + (n-1)
from generate_series(1,3) n;
SQL

curl -s -X POST "$API/functions/v1/generate-prayer-plan" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"continue_plan_id":"cccc0000-0000-0000-0000-000000000002"}'
echo

echo "5. Plan inexistente (debe ser 404)"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" -X POST "$API/functions/v1/generate-prayer-plan" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"continue_plan_id":"cccc0000-0000-0000-0000-0000000000ff"}'
