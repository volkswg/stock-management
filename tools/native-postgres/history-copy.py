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
    lean=json.loads((ROOT/'tests/fixtures/lean-loyverse-before.json').read_text())
    row_edits=json.loads((ROOT/'tests/fixtures/row-edits-before.json').read_text())
    cleanup=json.loads((ROOT/'tests/fixtures/safe-compatibility-cleanup-before.json').read_text())
    uploads=json.loads((ROOT/'tests/fixtures/order-image-uploads-before.json').read_text())
    fixture=json.loads((ROOT/'tests/fixtures/native-postgres-before.json').read_text())
    followup=json.loads((ROOT/'tests/fixtures/native-null-json-before.json').read_text())
    accounts=json.loads((ROOT/'tests/fixtures/postgres-accounts-before.json').read_text())
    bills=json.loads((ROOT/'tests/fixtures/bill-identity-before.json').read_text())
    revision=json.loads((ROOT/'tests/fixtures/bill-revision-before.json').read_text())
    sessions=json.loads((ROOT/'tests/fixtures/user-state-identity-before.json').read_text())
    items=json.loads((ROOT/'tests/fixtures/item-identity-before.json').read_text())
    references=json.loads((ROOT/'tests/fixtures/movement-reference-before.json').read_text())
    for name,expected in fixture['files'].items():
        edit=fixture['edits'].get(name)
        source=ROOT/name
        current=source.read_bytes() if source.exists() else None
        lean_edit=lean['edits'].get(name)
        if lean_edit:
            assert (digest(current) if current is not None else None)==lean_edit['afterSha256'],name
            current=lean_edit['before'].encode()
            assert digest(current)==lean_edit['beforeSha256'],name
        row_edit=row_edits['edits'].get(name)
        if row_edit:
            assert (digest(current) if current is not None else None)==row_edit['afterSha256'],name
            current=row_edit['before'].encode()
            assert digest(current)==row_edit['beforeSha256'],name
        cleanup_edit=cleanup['edits'].get(name)
        if cleanup_edit:
            assert (digest(current) if current is not None else None)==cleanup_edit['afterSha256'],name
            current=cleanup_edit['before'].encode()
            assert digest(current)==cleanup_edit['beforeSha256'],name
        upload_edit=uploads['edits'].get(name)
        if upload_edit:
            assert (digest(current) if current is not None else None)==upload_edit['afterSha256'],name
            current=upload_edit['before'].encode()
            assert digest(current)==upload_edit['beforeSha256'],name
        reference_edit=references['edits'].get(name)
        if reference_edit:
            assert (digest(current) if current is not None else None)==reference_edit['afterSha256'],name
            current=reference_edit['before'].encode()
            assert digest(current)==reference_edit['beforeSha256'],name
        item_edit=items['edits'].get(name)
        if item_edit:
            assert (digest(current) if current is not None else None)==item_edit['afterSha256'],name
            current=item_edit['before'].encode()
            assert digest(current)==item_edit['beforeSha256'],name
        session_edit=sessions['edits'].get(name)
        if session_edit:
            assert (digest(current) if current is not None else None)==session_edit['afterSha256'],name
            current=session_edit['before'].encode()
            assert digest(current)==session_edit['beforeSha256'],name
        revision_edit=revision['edits'].get(name)
        if revision_edit:
            assert (digest(current) if current is not None else None)==revision_edit['afterSha256'],name
            current=revision_edit['before'].encode()
            assert digest(current)==revision_edit['beforeSha256'],name
        bill_edit=bills['edits'].get(name)
        if bill_edit:
            assert (digest(current) if current is not None else None)==bill_edit['afterSha256'],name
            current=bill_edit['before'].encode()
            assert digest(current)==bill_edit['beforeSha256'],name
        account_edit=accounts['edits'].get(name)
        if account_edit:
            assert (digest(current) if current is not None else None)==account_edit['afterSha256'],name
            current=account_edit['before'].encode()
            assert digest(current)==account_edit['beforeSha256'],name
        delta=followup['edits'].get(name)
        if delta:
            assert current is not None and digest(current)==delta['afterSha256'],name
            current=delta['before'].encode()
            assert digest(current)==delta['beforeSha256'],name
        if edit:
            if edit['afterSha256'] is None:assert current is None,name
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
