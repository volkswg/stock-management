#!/usr/bin/env bash
# Synthetic-only PostgreSQL 17 fixture. No published ports or real service files.
set -euo pipefail
cd "$(dirname "$0")/../.."
socket=${DOCKER_HOST:-unix:///var/run/docker.sock}
case "$socket" in unix://*) ;; *) echo 'A local Unix Docker socket is required' >&2; exit 1;; esac
test -S "${socket#unix://}"
image=${STOCK_FINGERPRINT_TEST_IMAGE:-postgres:17.7}
case "$image" in postgres:17.*|postgres@sha256:*) ;; *) echo 'A PostgreSQL 17 fixture image is required' >&2; exit 1;; esac
name="stock-recovery-fingerprint-verify-$$"
artifacts=$(mktemp -d)
container=''
cleanup(){
  if test -n "$container"; then docker --host="$socket" rm -fv "$container" >/dev/null; fi
  rm -rf "$artifacts"
}
trap cleanup EXIT
container=$(docker --host="$socket" run -d --name "$name" --network=none --memory=2g --memory-swap=2g -e POSTGRES_HOST_AUTH_METHOD=trust "$image")
for attempt in $(seq 1 60); do
  if docker --host="$socket" exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker --host="$socket" exec "$container" createdb -U postgres recovery_fingerprint_test
python3 tools/migration/recovery-fingerprint-integration.py > "$artifacts/fingerprint.sql"
if ! docker --host="$socket" exec -i "$container" psql -XqAt -U postgres -d recovery_fingerprint_test -v ON_ERROR_STOP=1 < "$artifacts/fingerprint.sql" > "$artifacts/result.log" 2>&1; then
  cat "$artifacts/result.log" >&2
  exit 1
fi
grep '^recovery-fingerprint:' "$artifacts/result.log"
test "$(docker --host="$socket" inspect --format '{{.HostConfig.Memory}}' "$container")" = 2147483648
test "$(docker --host="$socket" inspect --format '{{.State.OOMKilled}}' "$container")" = false
docker --host="$socket" exec "$container" pg_isready -U postgres >/dev/null
echo 'PASS: PostgreSQL 17 fingerprint compatibility, single evaluation and 96MiB JSONB under a 2GiB cap; no published ports'
