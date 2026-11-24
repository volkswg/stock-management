"""Exact pooling-release inverse for immutable historical checks only."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def before_seller(name, data):
    seller_edit = json.loads((ROOT / 'tests/fixtures/order-seller-before.json').read_text())['edits'].get(name)
    if seller_edit:
        assert data is not None and hashlib.sha256(data).hexdigest() == seller_edit['afterSha256'], name
        lines = data.decode().splitlines(keepends=True)
        for delta in reversed(seller_edit['inverse']):
            lines[delta['start']:delta['start'] + delta['count']] = [delta['before']]
        data = ''.join(lines).encode()
        assert hashlib.sha256(data).hexdigest() == seller_edit['beforeSha256'], name
    return data


def before_pooling(name, data):
    edit = json.loads((ROOT / 'tests/fixtures/connection-pooling-before.json').read_text())['edits'].get(name)
    if not edit:
        return data
    assert data is not None and hashlib.sha256(data).hexdigest() == edit['afterSha256'], name
    lines = data.decode().splitlines(keepends=True)
    for delta in reversed(edit['inverse']):
        lines[delta['start']:delta['start'] + delta['count']] = [delta['before']]
    result = ''.join(lines).encode()
    assert hashlib.sha256(result).hexdigest() == edit['beforeSha256'], name
    return result
