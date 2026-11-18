"""Recovery must include the new catalog explicitly; never certify a partial backup."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import recovery


class MediaRecoveryTests(unittest.TestCase):
    def test_media_layout_adds_catalog_to_full_row_fingerprints(self):
        old = recovery.fingerprint_sql()
        new = recovery.fingerprint_sql(include_media=True)
        self.assertEqual(old.count("json_build_object('table',"), 51)
        self.assertEqual(new.count("json_build_object('table',"), 52)
        self.assertEqual(new.count("json_build_object('metadata',"), 15)
        self.assertIn("FROM stock_operational.media t", new)
        self.assertIn("to_regclass('stock_operational.media') IS NULL", recovery.history_guard_sql('revision'))
        self.assertIn("to_regclass('stock_operational.media') IS NOT NULL", recovery.history_guard_sql('revision', True))

    def test_media_receipt_cannot_be_verified_under_older_layout(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)
            (p/'database.dump').write_bytes(b'synthetic backup')
            (p/'fingerprint.json').write_text('[]')
            receipt = {'dumpSha256':recovery.checksum(p/'database.dump'), 'fingerprintSha256':recovery.checksum(p/'fingerprint.json'), 'includesMediaCatalog':True}
            (p/'receipt.json').write_text(json.dumps(receipt))
            with patch.object(recovery, 'exported_snapshot') as snapshot:
                with self.assertRaisesRegex(ValueError, 'media layout mismatch'):
                    recovery.verify(p, '00000000-0000-0000-0000-000000000001')
                snapshot.assert_not_called()
