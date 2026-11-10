import contextlib
import hashlib
import io
import json
import struct
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from jsonb_stream import jsonb_equal,verify_snapshot,ReadSession
from recovery import fingerprint,METADATA_NAMES

class JsonbStreamTests(unittest.TestCase):
    def test_jsonb_equality_keeps_types_all_fields_and_exact_numbers(self):
        self.assertTrue(jsonb_equal({'v':[Decimal('9007199254740993.01'),Decimal('1.00'),False,None]}, {'v':[Decimal('9007199254740993.010'),1,False,None]}))
        for a,b in [(True,1),(1,True),('1',1),(None,''),([1],[1,2]),({'x':1},{'x':1,'extra':None}),(Decimal('9007199254740993.01'),Decimal('9007199254740993.02'))]:self.assertFalse(jsonb_equal(a,b))
    def test_full_binding_rejects_formula_changes_even_with_matching_batch_identity(self):
        source={'spreadsheetId':'synthetic-only','sheets':{'orders':{'formulaRows':[['=A2']],'rawRows':[[False,1,None]]}},'sourceExtensions':{'preserved':'legacy'}}
        sql=[];session=SimpleNamespace(rows=lambda q:sql.append(q) or [b'1\n'])
        for changed in [False,True]:
            stored=json.loads(json.dumps(source))
            if changed:stored['sheets']['orders']['formulaRows'][0][0]='=B2'
            with patch('jsonb_stream.jsonb_fragments',return_value=iter([json.dumps(stored)])):
                if changed:
                    with self.assertRaisesRegex(ValueError,'full frozen snapshot'):verify_snapshot(session,source)
                else:verify_snapshot(session,source)
        self.assertTrue(all('checksum=' in q and 'workbook=' in q and 'formulaRows' not in q for q in sql))
    def test_missing_batch_stops_before_snapshot_read(self):
        session=SimpleNamespace(rows=lambda q:(_ for _ in ()).throw(ValueError('guard failed')))
        with patch('jsonb_stream.jsonb_fragments',side_effect=AssertionError('must not read')):
            with self.assertRaisesRegex(ValueError,'guard failed'):verify_snapshot(session,{'spreadsheetId':'synthetic'})
    def wire(self,values):
        data=b'PGCOPY\n\xff\r\n\x00'+struct.pack('!ii',0,0)
        for text in values:
            raw=text.encode('utf8');data+=struct.pack('!hiii',2,4,len(text),len(raw))+raw
        return data+struct.pack('!h',-1)+b'private-query-end\n'
    def test_exact_streamed_character_prefix_unicode_duplicates_and_empty(self):
        for values in [[],[''],['Z','a','é','ไทย 😀','ไทย 😀'],['null','9007199254740993.01','line\nquote"\\']]:
            process=SimpleNamespace(stdin=io.BytesIO(),stdout=io.BytesIO(self.wire(values)))
            result=ReadSession(process).table_fingerprint('public.synthetic')
            expected=hashlib.sha256(b''.join((str(len(v))+':'+v).encode('utf8') for v in values)).hexdigest()
            self.assertEqual(result,{'table':'public.synthetic','rows':len(values),'sha256':expected})
            sql=process.stdin.getvalue();self.assertIn(b'ORDER BY v COLLATE "C"',sql);self.assertNotIn(b'string_agg',sql)
    def test_truncated_transport_never_returns_a_partial_hash(self):
        for data in [self.wire(['x'])[:-4],self.wire(['x'])[:20],b'bad']:
            with self.assertRaises(ValueError):ReadSession(SimpleNamespace(stdin=io.BytesIO(),stdout=io.BytesIO(data))).table_fingerprint('public.synthetic')
    def test_same_snapshot_tls_uuid_both_locks_and_original_deadline_for_every_connection(self):
        begins=[];tables=[]
        class Session:
            def table_fingerprint(self,table):tables.append(table);return {'table':table,'rows':0,'sha256':'synthetic'}
            def rows(self,query):
                name=query.split("'metadata','",1)[1].split("'",1)[0]
                return [json.dumps({'metadata':name,'value':[]}).encode()]
        def read(begin,timeout):begins.append((begin,timeout));return contextlib.nullcontext(Session())
        with patch('recovery.exported_snapshot',return_value=contextlib.nullcontext('00000001-00000002-1')),patch('recovery.read_session',side_effect=read),patch('recovery.batch_fingerprint',return_value={'table':'stock_migration.import_batches','rows':0,'sha256':'synthetic'}):result=fingerprint('00000000-0000-0000-0000-000000000001')
        self.assertEqual(len(result),66);self.assertEqual(len(tables),50);self.assertEqual(len(begins),52)
        self.assertEqual({x['metadata'] for x in result if 'metadata' in x},METADATA_NAMES)
        for sql,timeout in begins:
            for guard in ['READ ONLY',"SET TRANSACTION SNAPSHOT '00000001-00000002-1'",'pg_stat_ssl',"purpose='isolated-staging'",'pg_advisory_xact_lock_shared(835107241)','pg_advisory_xact_lock_shared(835107242)',"statement_timeout='120s'","client_encoding='UTF8'"]:self.assertIn(guard,sql)
            self.assertGreater(timeout,0);self.assertLessEqual(timeout,150)
if __name__=='__main__':unittest.main()
