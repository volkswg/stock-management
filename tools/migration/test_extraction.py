import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from core import CATALOG
from migrate import main
from test_migration import fixture


class ExtractionTests(unittest.TestCase):
    def test_empty_workbook_extraction_checks_full_frozen_batch_and_keeps_identity(self):
        source=fixture()
        for sheet in source['sheets'].values():sheet['rows']=[]
        source['sheets']['orders']['formulaRows']=[['=empty_formula_marker']]
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory,'source.json');path.write_text(json.dumps(source));output=Path(directory,'archive.json')
            session=SimpleNamespace(rows=lambda query:[])
            with patch('sys.argv',['migrate.py','database-snapshot','--source',str(path),'--output',str(output)]),patch('migrate.read_session',return_value=contextlib.nullcontext(session)) as read,patch('migrate.verify_snapshot') as verify:
                self.assertEqual(main(),0)
                sql=read.call_args.args[0]
                self.assertIn('READ ONLY',sql)
                self.assertIn('pg_advisory_xact_lock_shared(835107241)',sql)
                self.assertIn('pg_stat_ssl',sql)
                verify.assert_called_once_with(session,source)
            actual=json.loads(output.read_text())
            self.assertEqual(actual['spreadsheetId'],'synthetic-only')
            self.assertTrue(actual['archiveEvidence']['fullSnapshotVerified'])

    def test_batch_mismatch_leaves_no_output_and_error_is_not_logged(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory,'source.json');path.write_text(json.dumps(fixture()));output=Path(directory,'archive.json')
            session=SimpleNamespace(rows=lambda query:[])
            with patch('sys.argv',['migrate.py','database-snapshot','--source',str(path),'--output',str(output)]),patch('migrate.read_session',return_value=contextlib.nullcontext(session)),patch('migrate.verify_snapshot',side_effect=ValueError('full frozen snapshot differs from archive')):
                with self.assertRaisesRegex(ValueError,'full frozen snapshot'):main()
            self.assertFalse(output.exists())

    def test_reconciliation_never_prints_private_ids_or_totals(self):
        source=fixture();target=fixture();target['sheets']['orders']['rows'][0][3]='999.11'
        with tempfile.TemporaryDirectory() as directory:
            a,b,report=[Path(directory,n) for n in ['a.json','b.json','report.json']]
            a.write_text(json.dumps(source));b.write_text(json.dumps(target));log=io.StringIO()
            with patch('sys.argv',['migrate.py','reconcile',str(a),str(b),'--output',str(report)]),contextlib.redirect_stdout(log):
                self.assertEqual(main(),1)
            self.assertNotIn('orders-1',log.getvalue());self.assertNotIn('999.11',log.getvalue())
            self.assertIn('orders-1',report.read_text());self.assertEqual(report.stat().st_mode & 0o777,0o600)
