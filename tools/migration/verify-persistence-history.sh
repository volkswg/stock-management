#!/usr/bin/env bash
# Archived schema acceptance uses exactly the PR79 record adapter in a disposable
# credential-free source copy. Current typed acceptance runs separately.
set -euo pipefail
cd "$(dirname "$0")/../.."
history_root=$(mktemp -d "${TMPDIR:-/tmp}/stock-persistence-history.XXXXXX")
trap 'rm -rf "$history_root"' EXIT
python3 - "$history_root" <<'PY'
import hashlib,json,os,shutil,subprocess,sys
from pathlib import Path
root=Path.cwd();target=Path(sys.argv[1]);fixture=json.loads((root/'tests/fixtures/typed-postgres-before.json').read_text())
for name in subprocess.check_output(['git','ls-files','-z'],text=True).split('\0'):
 if not name:continue
 source=root/name
 if source.is_file():
  dest=target/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
for name,edit in fixture['edits'].items():
 assert hashlib.sha256(edit['before'].encode()).hexdigest()==edit['beforeSha256']
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==edit['afterSha256']
 (target/name).write_text(edit['before'])
os.symlink((root/'node_modules').resolve(),target/'node_modules',target_is_directory=True)
assert {p.name for p in target.glob('.env*')} <= {'.env.example'} and not(target/'.vercel').exists()
PY
for stage in operational named-columns row-order native-timestamps cell-kinds cell-kinds-final lexemes lexemes-final; do
 echo "Historical schema acceptance: $stage (pinned PR79 record adapter)"
 bash "$history_root/tools/migration/verify-$stage.sh"
done
