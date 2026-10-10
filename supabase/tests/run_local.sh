#!/usr/bin/env bash
# Rebuild a local Supabase-like database, apply all migrations, run RLS verification.
# Usage: PGHOST=<socket dir> PGPORT=<port> ./supabase/tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -U postgres -c "drop database if exists aiva" -c "drop role if exists supa_owner" -c "drop role if exists anon" -c "drop role if exists authenticated" -c "drop role if exists service_role" >/dev/null
$P -U postgres -f supabase/tests/local_supabase_stub.sql >/dev/null
for f in supabase/migrations/*.sql; do $P -U supa_owner -d aiva -f "$f" 2>&1 | grep -v NOTICE || true; done
psql -U supa_owner -d aiva -f supabase/tests/rls_verification.sql 2>&1 | sed 's/^psql:[^E]*ERROR:  //'
