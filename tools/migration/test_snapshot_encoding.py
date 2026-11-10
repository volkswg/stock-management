import copy
import json
import unittest
from decimal import Decimal
from core import canonical,digest,import_sql,load_json
from jsonb_stream import jsonb_equal
from snapshot_encoding import encode_snapshot,decode_snapshot,COMPACT,MARKER
from test_migration import fixture

class SnapshotEncodingTests(unittest.TestCase):
    def test_raw_default_remains_identical_and_optin_changes_only_batch_representation(self):
        source=fixture();source['sourceExtensions']={'formulaRows':[['=A2','ไทย 😀',Decimal('9007199254740993.0100'),False,None]]}
        self.assertIs(encode_snapshot(source),source)
        plain=import_sql(source);compact=import_sql(source,snapshot_encoding=COMPACT)
        prefix='INSERT INTO stock_migration.import_batches'
        self.assertEqual(plain.split(prefix)[0],compact.split(prefix)[0])
        self.assertIn(canonical(source),plain)
        self.assertNotIn(canonical(source),compact)
        self.assertIn(digest(source),compact)
        self.assertIn(MARKER,compact)
        self.assertTrue(plain.endswith('COMMIT;\n') and compact.endswith('COMMIT;\n'))
    def test_lossless_roundtrip_keeps_every_field_type_unicode_formula_and_precision(self):
        source={'sheets':{'x':{'raw':[[False,1,None,'null']], 'formulaRows':[['=SUM(A2:A4)']]}},'sourceExtensions':{'legacy':'ไทย 😀'},'money':Decimal('9007199254740993.0100'),'tiny':Decimal('0.10000000000000000000001')}
        encoded=encode_snapshot(source,COMPACT)
        decoded=decode_snapshot(encoded,expected_bytes=len(canonical(source).encode('utf8')),expected_sha256=digest(source))
        self.assertTrue(jsonb_equal(source,decoded))
        self.assertEqual(canonical(source),canonical(decoded))
        self.assertIs(decode_snapshot(source),source)
    def test_trusted_bound_checksum_format_payload_and_trailing_stream_are_checked(self):
        source={'payload':'x'*20000};encoded=encode_snapshot(source,COMPACT);size=len(canonical(source).encode())
        mutations=[lambda e:e[MARKER].update(encoding='unknown'),lambda e:e[MARKER].update(uncompressedBytes=size-1),lambda e:e[MARKER].update(sha256='0'*64),lambda e:e[MARKER].update(payload='!'),lambda e:e[MARKER].update(extra='field')]
        for mutation in mutations:
            changed=copy.deepcopy(encoded);mutation(changed)
            with self.assertRaises(ValueError):decode_snapshot(changed,expected_bytes=size,expected_sha256=digest(source))
        with self.assertRaises(ValueError):decode_snapshot(encoded)
        with self.assertRaises(ValueError):decode_snapshot(encoded,expected_bytes=True,expected_sha256=digest(source))
        import base64
        changed=copy.deepcopy(encoded);changed[MARKER]['payload']=base64.b64encode(base64.b64decode(encoded[MARKER]['payload'])+b'trailing').decode()
        with self.assertRaises(ValueError):decode_snapshot(changed,expected_bytes=size,expected_sha256=digest(source))
    def test_forged_bound_and_truncated_streams_fail(self):
        import base64,gzip
        source={'p':'x'};size=len(canonical(source).encode());checksum=digest(source)
        forged=encode_snapshot(source,COMPACT)
        forged[MARKER]['payload']=base64.b64encode(gzip.compress(b'x'*1000000)).decode()
        with self.assertRaises(ValueError):decode_snapshot(forged,expected_bytes=size,expected_sha256=checksum)
        valid=encode_snapshot(source,COMPACT)
        valid[MARKER]['payload']=base64.b64encode(base64.b64decode(valid[MARKER]['payload'])[:-4]).decode()
        with self.assertRaises(ValueError):decode_snapshot(valid,expected_bytes=size,expected_sha256=checksum)
    def test_full_binding_accepts_both_formats_and_rejects_changed_fields(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        from jsonb_stream import verify_snapshot
        source=fixture();source['sourceExtensions']={'formulaRows':[['=A2',False,Decimal('9007199254740993.01')]]}
        session=SimpleNamespace(rows=lambda q:[b'1\n']);encoded=encode_snapshot(source,COMPACT)
        with patch('jsonb_stream.jsonb_fragments',return_value=iter([canonical(encoded)])):verify_snapshot(session,source)
        changed=copy.deepcopy(source);changed['sourceExtensions']['formulaRows'][0][0]='=B2'
        with patch('jsonb_stream.jsonb_fragments',return_value=iter([canonical(encoded)])):
            with self.assertRaises(ValueError):verify_snapshot(session,changed)
    def test_large_payload_is_optin_small_transport_and_default_does_not_silently_convert(self):
        source=fixture();source['sourceExtensions']={'large':'x'*(4*1024*1024)}
        encoded=encode_snapshot(source,COMPACT)
        self.assertLess(len(canonical(encoded)),len(canonical(source))//50)
        self.assertIs(encode_snapshot(source),source)
        with self.assertRaises(ValueError):encode_snapshot(source,'unsupported')

if __name__=='__main__':unittest.main()
