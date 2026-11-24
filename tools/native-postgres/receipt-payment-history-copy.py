"""Pinned PR98 source for its immutable pre-JSONB rebuild/inverse witnesses only.

Current acceptance runs physical current owners separately after JSONB install,
with the operational payment table absent. Never overlay the current checkout.
"""
import hashlib
import json
import os
from pathlib import Path
import sys

from pooling_history import before_pooling, before_seller
ROOT = Path(__file__).resolve().parents[2]


def copy_previous(target):
    target = Path(target)
    if target.exists() and any(target.iterdir()):
        raise ValueError('Destination must be empty')
    fixture = json.loads((ROOT / 'tests/fixtures/receipt-payment-retirement-before.json').read_text())
    products=json.loads((ROOT/'tests/fixtures/product-master-uat-before.json').read_text())
    wrappers = json.loads((ROOT/'tests/fixtures/wrapper-cleanup-before.json').read_text())
    naming = json.loads((ROOT / 'tests/fixtures/sales-naming-before.json').read_text())
    shipment = json.loads((ROOT / 'tests/fixtures/order-detail-shipment-before.json').read_text())
    for name, expected in fixture['files'].items():
        source = ROOT / name
        data = source.read_bytes() if source.exists() else None
        data=before_seller(name,data)
        movement_edit=json.loads((ROOT/'tests/fixtures/movement-shop-ids-before.json').read_text())['edits'].get(name)
        if movement_edit:
            assert (hashlib.sha256(data).hexdigest() if data is not None else None)==movement_edit['afterSha256'],name
            data=movement_edit['before'].encode()
            assert hashlib.sha256(data).hexdigest()==movement_edit['beforeSha256'],name
        data=before_pooling(name,data)
        product_edit=products['edits'].get(name)
        if product_edit:
            assert (hashlib.sha256(data).hexdigest() if data is not None else None)==product_edit['afterSha256'],name
            data=product_edit['before'].encode()
            assert hashlib.sha256(data).hexdigest()==product_edit['beforeSha256'],name
        wrapper_edit = wrappers['edits'].get(name)
        if wrapper_edit:
            assert (hashlib.sha256(data).hexdigest() if data is not None else None) == wrapper_edit['afterSha256'], name
            data = wrapper_edit['before'].encode()
            assert hashlib.sha256(data).hexdigest() == wrapper_edit['beforeSha256'], name
        naming_edit = naming['edits'].get(name)
        if naming_edit:
            assert (hashlib.sha256(data).hexdigest() if data is not None else None) == naming_edit['afterSha256'], name
            data = naming_edit['before'].encode()
            assert hashlib.sha256(data).hexdigest() == naming_edit['beforeSha256'], name
        shipment_edit = shipment['edits'].get(name)
        if shipment_edit:
            assert (hashlib.sha256(data).hexdigest() if data is not None else None) == shipment_edit['afterSha256'], name
            data = shipment_edit['before'].encode()
            assert hashlib.sha256(data).hexdigest() == shipment_edit['beforeSha256'], name
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
