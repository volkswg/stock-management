#!/usr/bin/env bash
# Archived schema acceptance uses exactly the PR79 record adapter in a disposable
# credential-free source copy. Current typed acceptance runs separately.
set -euo pipefail
cd "$(dirname "$0")/../.."
history_root=$(mktemp -d "${TMPDIR:-/tmp}/stock-persistence-history.XXXXXX")
trap 'rm -rf "$history_root"' EXIT
python3 - "$history_root" "${1:-schema}" <<'PY'
import hashlib,json,os,shutil,subprocess,sys
from pathlib import Path
root=Path.cwd();target=Path(sys.argv[1]);fixture=json.loads((root/'tests/fixtures/typed-postgres-before.json').read_text())
names=[n for n in subprocess.check_output(['git','ls-files','-z'],text=True).split('\0') if n]
for name in names:
 if not name:continue
 source=root/name
 if source.is_file():
  dest=target/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
for name,edit in fixture['edits'].items():
 assert hashlib.sha256(edit['before'].encode()).hexdigest()==edit['beforeSha256']
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==edit['afterSha256']
 (target/name).write_text(edit['before'])
# Scoped edit tokens target the final typed schema. Keep archived-schema proof
# on its hash-bound predecessor route/client as well as the PR79 adapter.
concurrent=json.loads((root/'tests/fixtures/concurrent-edits-before.json').read_text())
for name,edit in concurrent['edits'].items():
 assert hashlib.sha256(edit['before'].encode()).hexdigest()==edit['beforeHash']
 assert hashlib.sha256((root/name).read_bytes()).hexdigest()==edit['afterHash']
 (target/name).write_text(edit['before'])
if sys.argv[2]=='--hosted-tooling':
 # Next's private build requires a real dependency root. Preserve the original
 # shared install; remove only this owned source copy at exit.
 shutil.copytree((root/'node_modules').resolve(),target/'node_modules',symlinks=True)
 # The private-build attestation requires HEAD. Use a new synthetic source
 # snapshot, never the user's Git state, hooks, signing or credentials.
 git_env={'PATH':os.environ['PATH'],'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':os.devnull,
  'GIT_AUTHOR_NAME':'Synthetic Historical Fixture','GIT_AUTHOR_EMAIL':'fixture@example.invalid',
  'GIT_COMMITTER_NAME':'Synthetic Historical Fixture','GIT_COMMITTER_EMAIL':'fixture@example.invalid'}
 def git(*args):subprocess.run(['git','-C',str(target),'-c','core.hooksPath=/dev/null',*args],env=git_env,check=True,stdout=subprocess.DEVNULL)
 git('init','--quiet','--template=')
 for i in range(0,len(names),50):git('add','--force','--',*names[i:i+50])
 git('commit','--quiet','--no-gpg-sign','-m','Synthetic historical fixture with pinned PR79 record adapter')
else:os.symlink((root/'node_modules').resolve(),target/'node_modules',target_is_directory=True)
assert {p.name for p in target.glob('.env*')} <= {'.env.example'} and not(target/'.vercel').exists()
PY
case "${1:-schema}" in
 schema) stages=(operational named-columns row-order native-timestamps cell-kinds cell-kinds-final lexemes lexemes-final);;
 --hosted-tooling) stages=(hosted-tooling);;
 *) echo 'Unsupported historical verification scope' >&2; exit 1;;
esac
for stage in "${stages[@]}"; do
 echo "Historical schema acceptance: $stage (pinned PR79 record adapter)"
 bash "$history_root/tools/migration/verify-$stage.sh"
done
