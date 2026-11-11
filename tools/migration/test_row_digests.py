"""Independent canonical-row digest oracle and transport/format rejection."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from jsonb_stream import ReadSession
from recovery import verify,checksum

class RowDigestTests(unittest.TestCase):
    def test_all_bytes_duplicates_unicode_exact_numbers_and_empty(self):
        for rows in [[],['null'],['{"money": 9007199254740993.01}','{"x": true}','{"x": null}','{"x": "ไทย 😀"}','{"x": "ไทย 😀"}']]:
            hashes=sorted(hashlib.sha256(s.encode()).digest() for s in rows)
            expected=hashlib.sha256(b'stock-table-row-sha256-v2\x00'+b''.join(hashes)).hexdigest()
            session=ReadSession(None);session.rows=lambda _: [h.hex().encode()+b'\n' for h in hashes]
            result=session.digest_table_fingerprint('public.synthetic')
            self.assertEqual(result,{'table':'public.synthetic','rows':len(rows),'sha256':expected,'algorithm':'sorted-row-sha256-v2'})
    def test_bad_truncated_or_unsorted_transport_never_returns_a_hash(self):
        for lines in [[b'bad\n'],[b'a'*64],[b'z'*64+b'\n'],[b'f'*64+b'\n',b'0'*64+b'\n']]:
            session=ReadSession(None);session.rows=lambda _:lines
            with self.assertRaises(ValueError):session.digest_table_fingerprint('public.synthetic')
    def test_wrong_receipt_format_fails_before_connection(self):
        for row_digests,format in [(False,'sorted-row-sha256-v2'),(True,'legacy-jsonb-text-v1')]:
            with tempfile.TemporaryDirectory() as d,patch('recovery.exported_snapshot',side_effect=AssertionError('no IO')):
                p=Path(d);(p/'database.dump').write_bytes(b'synthetic');(p/'fingerprint.json').write_text('[]')
                (p/'receipt.json').write_text(json.dumps({'dumpSha256':checksum(p/'database.dump'),'fingerprintSha256':checksum(p/'fingerprint.json'),'fingerprintFormat':format}))
                with self.assertRaisesRegex(ValueError,'format mismatch'):verify(p,'00000000-0000-0000-0000-000000000001',row_digests=row_digests)
