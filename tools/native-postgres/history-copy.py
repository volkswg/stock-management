"""Reconstruct the pinned pre-native source for immutable historical witnesses.

Never overlay the current checkout. Native acceptance loads real current source
separately on fresh final-schema databases.
"""
import hashlib,json,os,sys,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def digest(data):return hashlib.sha256(data).hexdigest()
def copy_history(target):
    target=Path(target)
    if target.exists() and any(target.iterdir()):raise ValueError('Historical destination must be empty')
    fixture=json.loads((ROOT/'tests/fixtures/native-postgres-before.json').read_text())
    followup=json.loads((ROOT/'tests/fixtures/native-null-json-before.json').read_text())
    for name,expected in fixture['files'].items():
        edit=fixture['edits'].get(name)
        source=ROOT/name
        current=source.read_bytes() if source.exists() else None
        delta=followup['edits'].get(name)
        if delta:
            assert current is not None and digest(current)==delta['afterSha256'],name
            current=delta['before'].encode()
            assert digest(current)==delta['beforeSha256'],name
        if edit:
            if edit['afterSha256'] is None:assert not source.exists(),name
            else:assert current is not None and digest(current)==edit['afterSha256'],name
            data=edit['before'].encode()
        else:data=current
        assert digest(data)==expected,name
        dest=target/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
    os.symlink((ROOT/'node_modules').resolve(),target/'node_modules',target_is_directory=True)
    assert not list(target.glob('.env.*')) or {p.name for p in target.glob('.env.*')}=={'.env.example'}
    assert not (target/'.vercel').exists()
    # Some immutable acceptance tools attest HEAD/use git ls-files. Give this
    # owned fixture a credential-free synthetic Git identity, never the user's.
    env={'PATH':os.environ['PATH'],'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':os.devnull,
         'GIT_AUTHOR_NAME':'Pinned Pre-native Fixture','GIT_AUTHOR_EMAIL':'fixture@example.invalid',
         'GIT_COMMITTER_NAME':'Pinned Pre-native Fixture','GIT_COMMITTER_EMAIL':'fixture@example.invalid'}
    def git(*args):subprocess.run(['git','-C',str(target),'-c','core.hooksPath=/dev/null',*args],env=env,check=True,stdout=subprocess.DEVNULL)
    git('init','--quiet','--template=')
    names=list(fixture['files'])
    for i in range(0,len(names),50):git('add','--force','--',*names[i:i+50])
    git('commit','--quiet','--no-gpg-sign','-m','Synthetic source snapshot: pinned pre-native contracts')
    return target
if __name__=='__main__':copy_history(sys.argv[1])
