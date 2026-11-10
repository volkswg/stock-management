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
container=$(docker --host="$socket" run -d --name "$name" --network=none --memory=2g --memory-swap=2g -e POSTGRES_HOST_AUTH_METHOD=trust "$image" postgres -c shared_buffers=224MB -c work_mem=2184kB -c maintenance_work_mem=32MB -c max_connections=60 -c default_toast_compression=pglz -c restart_after_crash=off)
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
mkdir "$artifacts/bin"
printf '#!/usr/bin/env bash\nexec docker --host=%q exec -i %q psql -U postgres -d recovery_fingerprint_test "$@"\n' "$socket" "$container" > "$artifacts/bin/psql"
chmod 700 "$artifacts/bin/psql"
PGSERVICE=synthetic-fingerprint PATH="$artifacts/bin:$PATH" python3 tools/migration/jsonb-stream-integration.py
test "$(docker --host="$socket" inspect --format '{{.HostConfig.Memory}}' "$container")" = 2147483648
test "$(docker --host="$socket" inspect --format '{{.State.OOMKilled}}' "$container")" = false
docker --host="$socket" exec "$container" pg_isready -U postgres >/dev/null
echo 'PASS: legacy PostgreSQL 17 fingerprint compatibility and 96MiB JSONB oracle under the synthetic 2GiB cap'
# Only this disposable synthetic container is resized, never operator resources.
docker --host="$socket" update --memory=500000000 --memory-swap=500000000 "$container" >/dev/null
sampler=''
finish_sampler(){ if test -n "$sampler"; then kill "$sampler" 2>/dev/null || true; wait "$sampler" 2>/dev/null || true; sampler=''; fi; }
trap 'finish_sampler; cleanup' EXIT
(while :; do docker --host="$socket" exec "$container" cat /sys/fs/cgroup/memory.stat | awk '$1=="anon"||$1=="shmem"||$1=="kernel" {sum+=$2; found++} END {if (found!=3) exit 1; print sum}'; sleep .1; done) > "$artifacts/working-memory.log" &
sampler=$!
PGSERVICE=synthetic-fingerprint PATH="$artifacts/bin:$PATH" python3 tools/migration/snapshot-encoding-integration.py --expected "$artifacts/compact-expected.json"
docker --host="$socket" exec "$container" pg_dump -U postgres -d recovery_fingerprint_test -Fc -t public.compact_snapshot_fixture > "$artifacts/compact.dump"
docker --host="$socket" exec "$container" createdb -U postgres recovery_fingerprint_restore
docker --host="$socket" exec -i "$container" pg_restore -U postgres --exit-on-error --single-transaction --dbname=recovery_fingerprint_restore < "$artifacts/compact.dump"
printf '#!/usr/bin/env bash\nexec docker --host=%q exec -i %q psql -U postgres -d recovery_fingerprint_restore "$@"\n' "$socket" "$container" > "$artifacts/bin/psql"
PGSERVICE=synthetic-fingerprint PATH="$artifacts/bin:$PATH" python3 tools/migration/snapshot-encoding-integration.py --restore --expected "$artifacts/compact-expected.json"
finish_sampler
test "$(docker --host="$socket" inspect --format '{{.HostConfig.Memory}}' "$container")" = 500000000
test "$(docker --host="$socket" inspect --format '{{.HostConfig.MemorySwap}}' "$container")" = 500000000
test "$(docker --host="$socket" inspect --format '{{.State.OOMKilled}}' "$container")" = false
test "$(docker --host="$socket" inspect --format '{{.RestartCount}}' "$container")" = 0
docker --host="$socket" exec "$container" cat /sys/fs/cgroup/memory.events | awk '$1=="oom_kill" {found=1; if ($2!=0) exit 1} END {if (!found) exit 1}'
awk 'NF {if ($1>peak) peak=$1; count++} END {if (!count || peak>425000000) exit 1; printf "PASS: synthetic compact snapshot import/capture/independent restore at 500MB; sampled working peak %.0f bytes; no extra swap, OOM or published ports\n",peak}' "$artifacts/working-memory.log"
