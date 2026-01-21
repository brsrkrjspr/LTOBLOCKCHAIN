#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORT="${1:-db-verification-report.txt}"

cd "$ROOT_DIR"

if [[ ! -f "$ROOT_DIR/db-verify.sql" ]]; then
  echo "Missing db-verify.sql in repo root: $ROOT_DIR" >&2
  exit 1
fi

docker exec -i postgres psql -U lto_user -d lto_blockchain -v ON_ERROR_STOP=1 -f /dev/stdin < "$ROOT_DIR/db-verify.sql" \
  | tee "$ROOT_DIR/$REPORT"

echo
echo "Saved report to: $ROOT_DIR/$REPORT"

