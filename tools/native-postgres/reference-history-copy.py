"""Hash-pinned PR93 copy for its unchanged coupled-identity historical campaign.
Current removal acceptance always runs actual current source on separate copies.
"""
from pathlib import Path
import hashlib,json,os,sys
ROOT=Path(__file__).resolve().parents[2]
def copy_previous(target):
 target=Path(target)
 if target.exists() and any(target.iterdir()):raise ValueError('Destination must be empty')
 fixture=json.loads((ROOT/'tests/fixtures/movement-reference-before.json').read_text())
 for name,expected in fixture['files'].items():
  source=ROOT/name;data=source.read_bytes() if source.exists() else None;edit=fixture['edits'].get(name)
  if edit:
   assert (hashlib.sha256(data).hexdigest() if data is not None else None)==edit['afterSha256'],name
   data=edit['before'].encode()
  assert data is not None and hashlib.sha256(data).hexdigest()==expected,name
  dest=target/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 os.symlink((ROOT/'node_modules').resolve(),target/'node_modules',target_is_directory=True)
 assert not (target/'.vercel').exists() and not (target/'.git').exists()
 assert not list(target.glob('.env*')) or {p.name for p in target.glob('.env*')}=={'.env.example'}
 return target
if __name__=='__main__':copy_previous(sys.argv[1])
