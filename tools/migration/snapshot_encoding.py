"""Opt-in lossless archive representation. Never changes business row values."""
import base64
import binascii
import gzip
import hashlib
import re
import zlib

MARKER = '$stock_migration_snapshot'
PLAIN = 'plain-jsonb'
COMPACT = 'gzip-json-v1'


def encode_snapshot(source, encoding=PLAIN):
    if encoding == PLAIN:
        return source
    if encoding != COMPACT:
        raise ValueError('unsupported archive snapshot encoding')
    from core import canonical
    raw = canonical(source).encode('utf8')
    return {MARKER: {
        'encoding': COMPACT,
        'uncompressedBytes': len(raw),
        'sha256': hashlib.sha256(raw).hexdigest(),
        'payload': base64.b64encode(gzip.compress(raw, compresslevel=6, mtime=0)).decode('ascii'),
    }}


def is_encoded_snapshot(value):
    return isinstance(value, dict) and set(value) == {MARKER}


def decode_snapshot(value, *, expected_bytes=None, expected_sha256=None):
    if not is_encoded_snapshot(value):
        return value
    metadata = value[MARKER]
    if (not isinstance(metadata, dict)
            or set(metadata) != {'encoding', 'uncompressedBytes', 'sha256', 'payload'}
            or metadata['encoding'] != COMPACT):
        raise ValueError('unsupported compressed snapshot format')
    # The bound and checksum come from the independently approved source, never
    # from an untrusted compressed envelope. Default/raw snapshots still work.
    if (type(expected_bytes) is not int or expected_bytes < 1
            or not isinstance(expected_sha256, str)
            or not re.fullmatch('[0-9a-f]{64}', expected_sha256)
            or type(metadata['uncompressedBytes']) is not int
            or metadata['uncompressedBytes'] != expected_bytes
            or metadata['sha256'] != expected_sha256
            or not isinstance(metadata['payload'], str)):
        raise ValueError('compressed snapshot identity or output bound mismatch')
    max_compressed = expected_bytes + expected_bytes // 1000 + 1024
    if len(metadata['payload']) > 4 * ((max_compressed + 2) // 3):
        raise ValueError('compressed snapshot exceeds trusted input bound')
    try:
        compressed = base64.b64decode(metadata['payload'], validate=True)
        decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
        raw = decoder.decompress(compressed, expected_bytes + 1)
        if (len(raw) != expected_bytes or not decoder.eof
                or decoder.unconsumed_tail or decoder.unused_data
                or hashlib.sha256(raw).hexdigest() != expected_sha256):
            raise ValueError('compressed snapshot integrity mismatch')
        from core import load_json
        return load_json(raw)
    except (binascii.Error, zlib.error, UnicodeError) as error:
        raise ValueError('compressed snapshot is invalid') from None
