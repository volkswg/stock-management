import copy
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from core import CATALOG, normalize
from test_migration import fixture
from phase3 import delta_review, operational_snapshot

TARGET = '00000000-0000-0000-0000-000000000001'


def database_output(source):
    lines = [json.dumps({'environment': {'isolation_id': TARGET, 'purpose': 'isolated-staging'}})]
    for table, rows in normalize(source).items():
        for row in rows:
            typed = dict(row, archived_at=None)
            lines.append(json.dumps({'table': table, 'row': row['source_row'], 'cells': row['source_cells'], 'typed': typed}))
    return '\n'.join(lines)


class Phase3Tests(unittest.TestCase):
    def test_delta_classifies_changed_added_removed_and_moved_without_import_sql(self):
        before = fixture(); final = copy.deepcopy(before)
        final['sheets']['orders']['rows'][0][3] = '0.11'
        final['sheets']['orders']['rows'].insert(0, [])
        final['sheets']['expenses']['rows'] = []
        added = list(final['sheets']['orders']['rows'][1]); added[0] = 'new-order'
        final['sheets']['orders']['rows'].append(added)
        report = delta_review(before, final)
        self.assertEqual(report['tables']['orders']['changedIDs'], ['orders-1'])
        self.assertEqual(report['tables']['orders']['movedIDs'], ['orders-1'])
        self.assertEqual(report['tables']['orders']['addedIDs'], ['new-order'])
        self.assertEqual(report['tables']['expenses']['removedIDs'], ['expenses-1'])
        self.assertTrue(report['tables']['employee_compensations']['identityIsPositional'])
        self.assertFalse(report['automaticDeltaSupported'])

    def test_operational_snapshot_uses_readonly_transaction_and_preserves_all_records(self):
        source = fixture()
        with patch.dict(os.environ, {'STOCK_TARGET_ISOLATION_ID': TARGET, 'PGSERVICE':'synthetic'}), patch('phase3.subprocess.run', return_value=SimpleNamespace(returncode=0, stdout=database_output(source))) as run:
            self.assertEqual(normalize(operational_snapshot(source)), normalize(source))
            sql = run.call_args.kwargs['input']
            self.assertIn('READ ONLY', sql)
            self.assertNotIn('INSERT', sql)
            self.assertEqual(sql.count("'table',"), len(CATALOG))
            self.assertLess(sql.index('bool_and(isolation_id='),sql.index('FROM stock_operational.orders'))

    def test_wrong_target_archived_rows_and_typed_drift_are_rejected(self):
        output = database_output(fixture())
        for invalid in [output.replace(TARGET, '00000000-0000-0000-0000-000000000002'), output.replace('"archived_at": null', '"archived_at": "2026-11-09"'), output.replace('"totalPrice": "0.10"', '"totalPrice": "999"')]:
            with patch.dict(os.environ, {'STOCK_TARGET_ISOLATION_ID': TARGET, 'PGSERVICE':'synthetic'}), patch('phase3.subprocess.run', return_value=SimpleNamespace(returncode=0, stdout=invalid)):
                with self.assertRaises(ValueError): operational_snapshot(fixture())

    def test_changed_workbook_or_invalid_final_never_produces_delta_plan(self):
        final = fixture(); final['spreadsheetId'] = 'other'
        with self.assertRaises(ValueError): delta_review(fixture(), final)
        final = fixture(); final['sheets']['orders']['rows'] *= 2
        with self.assertRaises(ValueError): delta_review(fixture(), final)
