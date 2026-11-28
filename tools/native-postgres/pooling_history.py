"""Exact pooling-release inverse for immutable historical checks only."""
import hashlib
import json
import base64
import gzip
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def before_order_pagination(name, data):
    scoped = json.loads((ROOT / 'tests/fixtures/scoped-reads-before.json').read_text())['edits'].get(name)
    if scoped:
        assert data is not None and hashlib.sha256(data).hexdigest() == scoped['afterSha256'], name
        lines = data.decode().splitlines(keepends=True)
        for delta in reversed(scoped['inverse']):
            lines[delta['start']:delta['start'] + delta['count']] = [delta['before']]
        data = ''.join(lines).encode()
        assert hashlib.sha256(data).hexdigest() == scoped['beforeSha256'], name
    mobile = json.loads((ROOT / 'tests/fixtures/mobile-order-pagination-before.json').read_text())['edits'].get(name)
    if mobile:
        assert data is not None and hashlib.sha256(data).hexdigest() == mobile['afterSha256'], name
        lines = data.decode().splitlines(keepends=True)
        for delta in reversed(mobile['inverse']):
            lines[delta['start']:delta['start'] + delta['count']] = [delta['before']]
        data = ''.join(lines).encode()
        assert hashlib.sha256(data).hexdigest() == mobile['beforeSha256'], name
    persistence = json.loads((ROOT / 'tests/fixtures/order-page-size-persistence-before.json').read_text())['edits'].get(name)
    if persistence:
        assert data is not None and hashlib.sha256(data).hexdigest() == persistence['afterSha256'], name
        lines = data.decode().splitlines(keepends=True)
        for delta in reversed(persistence['inverse']):
            lines[delta['start']:delta['start'] + delta['count']] = [delta['before']]
        data = ''.join(lines).encode()
        assert hashlib.sha256(data).hexdigest() == persistence['beforeSha256'], name
    size_edit = json.loads((ROOT / 'tests/fixtures/order-page-size-before.json').read_text())['edits'].get(name)
    if size_edit:
        assert hashlib.sha256(data).hexdigest() == size_edit['afterSha256'], name
        lines = data.decode().splitlines(keepends=True)
        for delta in reversed(size_edit['inverse']):
            lines[delta['start']:delta['start'] + delta['count']] = [delta['before']]
        data = ''.join(lines).encode()
        assert hashlib.sha256(data).hexdigest() == size_edit['beforeSha256'], name
    pagination_edit = json.loads((ROOT / 'tests/fixtures/order-list-pagination-before.json').read_text())['edits'].get(name)
    if pagination_edit:
        assert data is not None and hashlib.sha256(data).hexdigest() == pagination_edit['afterSha256'], name
        lines = data.decode().splitlines(keepends=True)
        for delta in reversed(pagination_edit['inverse']):
            lines[delta['start']:delta['start'] + delta['count']] = [delta['before']]
        data = ''.join(lines).encode()
        assert hashlib.sha256(data).hexdigest() == pagination_edit['beforeSha256'], name
    return data


def before_seller(name, data):
    data = before_order_pagination(name, data)
    docs = json.loads((ROOT / 'tests/fixtures/docs-consolidation-before.json').read_text())['edits'].get(name)
    if docs:
        assert data is not None and hashlib.sha256(data).hexdigest() == docs['afterSha256'], name
        data = gzip.decompress(base64.b64decode(docs['beforeGzipBase64']))
        assert hashlib.sha256(data).hexdigest() == docs['beforeSha256'], name
    cleanup = json.loads((ROOT / 'tests/fixtures/raw-test-evidence-before.json').read_text())['edits'].get(name)
    if cleanup:
        assert data is not None and hashlib.sha256(data).hexdigest() == cleanup['afterSha256'], name
        lines = data.decode().splitlines(keepends=True)
        for delta in reversed(cleanup['inverse']):
            lines[delta['start']:delta['start'] + delta['count']] = [delta['before']]
        data = ''.join(lines).encode()
        assert hashlib.sha256(data).hexdigest() == cleanup['beforeSha256'], name
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
