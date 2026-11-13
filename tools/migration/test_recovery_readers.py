"""Reader concurrency, layout and fail-closed recovery contracts; no IO."""
import contextlib
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from recovery import fingerprint, fingerprint_sql, capture

class RecoveryReadersTests(unittest.TestCase):
    def fake_run(self,workers,history):
        active=0;peak=0;lock=threading.Lock();begins=[]
        class Session:
            def table_fingerprint(self,table):
                nonlocal active,peak
                with lock: active+=1;peak=max(peak,active)
                try:
                    time.sleep(.003)
                    return {'table':table,'rows':2,'sha256':table}
                finally:
                    with lock:active-=1
            def rows(self,query):
                return [json.dumps({'metadata':query.split("'metadata','",1)[1].split("'",1)[0],'value':[]}).encode()]
        def read(begin,timeout):
            begins.append((begin,timeout));return contextlib.nullcontext(Session())
        with patch('recovery.exported_snapshot',return_value=contextlib.nullcontext('00000001-00000002-1')),patch('recovery.read_session',side_effect=read),patch('recovery.batch_fingerprint',return_value={'table':'stock_migration.import_batches','rows':0,'sha256':'batch'}):
            result=fingerprint('00000000-0000-0000-0000-000000000001',workers=workers,history=history)
        return result,peak,begins
    def test_two_readers_keep_identical_inventory_order_hashes_and_all_guards(self):
        for history in ['audit','revision']:
            serial,peak1,_=self.fake_run(1,history)
            parallel,peak2,begins=self.fake_run(2,history)
            self.assertEqual(serial,parallel);self.assertEqual(len(parallel),66)
            self.assertEqual(peak1,1);self.assertEqual(peak2,2)
            self.assertIn('stock_operational.'+history,{r.get('table') for r in parallel})
            for begin,timeout in begins:
                self.assertIn("SET TRANSACTION SNAPSHOT '00000001-00000002-1'",begin)
                self.assertIn("to_regclass('stock_operational."+history+"') IS NOT NULL",begin)
                self.assertIn('READ ONLY',begin);self.assertIn('pg_stat_ssl',begin)
                self.assertIn('pg_advisory_xact_lock_shared(835107241)',begin)
                self.assertIn('pg_advisory_xact_lock_shared(835107242)',begin)
                self.assertGreater(timeout,0);self.assertLessEqual(timeout,150)
    def test_invalid_layout_or_reader_count_fails_before_any_io(self):
        with tempfile.TemporaryDirectory() as d,patch('subprocess.Popen',side_effect=AssertionError('no IO')):
            for kwargs in [{'workers':0},{'workers':3},{'workers':True},{'history':'other'},{'row_security_reader':1},{'row_security_reader':'true'}]:
                dest=Path(d)/'new'
                with self.assertRaises(ValueError):capture(dest,'00000000-0000-0000-0000-000000000001',**kwargs)
                self.assertFalse(dest.exists())
        with self.assertRaises(ValueError):fingerprint_sql('other')
    def test_reader_failure_never_returns_partial_inventory_or_retries(self):
        tables=[]
        class Session:
            def table_fingerprint(self,table):tables.append(table);raise ValueError('synthetic stream loss')
        with patch('recovery.exported_snapshot',return_value=contextlib.nullcontext('00000001-00000002-1')),patch('recovery.read_session',return_value=contextlib.nullcontext(Session())),patch('recovery.batch_fingerprint',return_value={'table':'stock_migration.import_batches','rows':0,'sha256':'batch'}):
            with self.assertRaises(ValueError):fingerprint('00000000-0000-0000-0000-000000000001',workers=2)
        self.assertLessEqual(len(tables),2);self.assertEqual(len(tables),len(set(tables)))
