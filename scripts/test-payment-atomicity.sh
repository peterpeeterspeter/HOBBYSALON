#!/usr/bin/env bash
# Synthetic fixtures ONLY: isolated PostgreSQL, no ports or external network.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
NAME="hobbysalon-payment-test-$$"
OUT=$(mktemp -d)
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$OUT"; }
trap cleanup EXIT
# Image may be cached; Docker fetches it if needed before starting isolation.
docker run -d --name "$NAME" --network none --memory 192m \
  -e POSTGRES_HOST_AUTH_METHOD=trust -v "$ROOT:/fixture:ro" postgres:16-alpine >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
$ready || { docker logs "$NAME"; exit 1; }
docker exec "$NAME" createdb -U postgres listing_payment_atomicity_test
sql() { docker exec "$NAME" psql -X -U postgres -d listing_payment_atomicity_test -v ON_ERROR_STOP=1 "$@"; }
sql -f /fixture/supabase/tests/listing_checkout_atomicity.sql
# Real independent connections: one application, all other deliveries duplicates.
pids=()
for n in 1 2 3 4; do
  sql -Atc "SELECT public.fulfill_listing_checkout('cs_parallel_credit','00000000-0000-4000-8000-000000000001','credit_pack','{\"credits\":\"7\"}');" > "$OUT/credit-$n" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
[[ $(sort "$OUT"/credit-* | uniq -c | tr '\n' ' ') == *"1 applied"* ]]
[[ $(sort "$OUT"/credit-* | uniq -c | tr '\n' ' ') == *"3 duplicate"* ]]
# Different sessions buying competing plans serialize per creator/segment.
pids=()
for plan in old new; do
  sql -Atc "SELECT public.fulfill_listing_checkout('cs_parallel_$plan','00000000-0000-4000-8000-000000000001','plan','{\"plan_code\":\"$plan\"}');" > "$OUT/plan-$plan" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
[[ $(sort "$OUT"/plan-* | uniq -c) == *"2 applied"* ]]
sql -c "DO \$\$ BEGIN
 ASSERT (SELECT count(*) = 1 FROM listing_credit_transactions WHERE metadata->>'stripe_session_id' = 'cs_parallel_credit');
 ASSERT (SELECT balance = 27 FROM listing_credit_wallets WHERE creator_id = '00000000-0000-4000-8000-000000000001');
 ASSERT (SELECT count(*) = 1 FROM creator_plan_subscriptions s JOIN commercial_plans p ON p.id=s.plan_id WHERE s.status='active' AND p.segment='maker');
 ASSERT (SELECT count(*) = 1 FROM creator_plan_subscriptions s JOIN commercial_plans p ON p.id=s.plan_id WHERE s.status='active' AND p.segment='supplier');
END \$\$;"
printf '\nPASS: SQL rollback, retry, permissions, and real concurrent payment delivery\n'
