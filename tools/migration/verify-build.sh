#!/usr/bin/env bash
# Production compilation in a disposable copy without application env files.
set -euo pipefail
cd "$(dirname "$0")/../.."
root=$PWD
build_dir=$(mktemp -d)
trap 'rm -rf "$build_dir"' EXIT
cp -R src public package.json yarn.lock tsconfig.json next.config.ts "$build_dir/"
# Turbopack rejects dependency symlinks outside the isolated root.
cp -a node_modules "$build_dir/node_modules"
cd "$build_dir"
env -i PATH="$PATH" CI=1 NEXT_TELEMETRY_DISABLED=1 npm run build
python3 - "$root" <<'PY'
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1])
for folder in ['src','public']:
 for source in (root/folder).rglob('*'):
  if source.is_file():
   assert source.read_bytes()==Path(source.relative_to(root)).read_bytes(),source
manifest=Path('.next/server/app-paths-manifest.json')
assert hashlib.sha256(manifest.read_bytes()).hexdigest()=='32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e','Route manifest changed'
chunks=list(Path('.next/static').rglob('*.js'))
for path in chunks:
 text=path.read_text()
 for private in ['STOCK_DATABASE_URL','STOCK_STAGING_AUTH_TOKEN','STOCK_TARGET_ISOLATION_ID','stock_operational','postgres://','postgresql://']:
  assert private not in text,(path,private)
print(json.dumps({'sourceMatches':True,'routeManifestUnchanged':True,'clientChunksChecked':len(chunks),'privateDatabaseStrings':0}))
PY
