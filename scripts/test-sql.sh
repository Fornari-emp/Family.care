#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica o esboço do Supabase + migrações e roda os testes de SQL.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -n "$BIN" ] || BIN="$(dirname "$(command -v initdb)")"
TMP="$(mktemp -d)"
trap '"$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT

RUN=""
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$TMP" 2>/dev/null && RUN="runuser -u postgres --"
fi
$RUN "$BIN/initdb" -D "$TMP/data" -A trust -U postgres >/dev/null
$RUN "$BIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -c listen_addresses=''" -w start >/dev/null
PSQL=(psql -h "$TMP" -U postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$ROOT/supabase/tests/rls_and_rpc.sql"
