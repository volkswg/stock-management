"""Pinned PR98 source for its immutable pre-JSONB rebuild/inverse witnesses only.

Current acceptance runs physical current owners separately after JSONB install,
with the operational payment table absent. Never overlay the current checkout.
"""
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]


def copy_previous(target):
    target = Path(target)
    if target.exists() and any(target.iterdir()):
        raise ValueError('Destination must be empty')
    fixture = json.loads((ROOT / 'tests/fixtures/receipt-payment-retirement-before.json').read_text())
    for name, expected in fixture['files'].items():
        source = ROOT / name
        data = source.read_bytes() if source.exists() else None
        edit = fixture['edits'].get(name)
        if edit:
            assert (hashlib.sha256(data).hexdigest() if data is not None else None) == edit['afterSha256'], name
            data = edit['before'].encode()
            assert hashlib.sha256(data).hexdigest() == edit['beforeSha256'], name
        assert data is not None and hashlib.sha256(data).hexdigest() == expected, name
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    os.symlink((ROOT / 'node_modules').resolve(), target / 'node_modules', target_is_directory=True)
    assert not (target / '.vercel').exists() and not (target / '.git').exists()
    assert not list(target.glob('.env*')) or {p.name for p in target.glob('.env*')} == {'.env.example'}
    return target


if __name__ == '__main__':
    copy_previous(sys.argv[1])
