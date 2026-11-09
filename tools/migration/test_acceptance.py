import copy
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from acceptance import acceptance, main
from core import CATALOG, digest
from test_migration import fixture


def valid():
    source = fixture()
    for table, spec in CATALOG.items():
        for index, column in enumerate(spec['headers']):
            if column == 'month': source['sheets'][table]['rows'][0][index] = '2026-11'
            elif column.endswith(('At', 'Date')) or column in ('date', 'effectiveFrom', 'packingDate', 'deliverDateTime'):
                source['sheets'][table]['rows'][0][index] = '2026-11-09'
    return source


def archive(source):
    result = copy.deepcopy(source)
    result['archiveEvidence'] = {'sourceChecksum': digest(source), 'fullSnapshotVerified': True}
    return result


class AcceptanceTests(unittest.TestCase):
    def test_all_23_tables_ids_relationships_decimal_totals_and_cells_are_reported(self):
        source = valid(); report = acceptance(source, archive(source), source)
        self.assertTrue(report['recordValidationPassed'])
        self.assertEqual(report['tableCount'], 23)
        self.assertEqual(set(report['tables']), set(CATALOG))
        self.assertEqual(report['tables']['orders']['records']['source']['totals']['totalPrice'], '0.10')
        self.assertEqual(report['tables']['order_items']['records']['source']['relationships']['orderId'], [['order_items-1', 'orders-1']])
        self.assertEqual(set(report['modules']), {'orders', 'shipments', 'inventory', 'sales', 'expenses', 'hr', 'line'})
        self.assertFalse(report['cutoverReady'])
        self.assertTrue(all(m['derivedBusinessAcceptance'].startswith('pending') for m in report['modules'].values()))

    def test_changed_financial_quantity_history_or_source_cell_blocks_reconciliation(self):
        source = valid()
        for table, index in [('orders', 3), ('stock_adjustments', 8), ('payroll_settlements', 4), ('user_state', 2)]:
            changed = copy.deepcopy(source); changed['sheets'][table]['rows'][0][index] = '0.11' if table in ('orders', 'stock_adjustments') else 'changed-history'
            report = acceptance(source, archive(source), changed)
            self.assertFalse(report['match'])
            self.assertFalse(report['recordValidationPassed'])
            self.assertFalse(report['tables'][table]['match'])

    def test_formulas_and_missing_archive_provenance_cannot_approve_data(self):
        source = valid()
        self.assertFalse(acceptance(source, source, source)['archiveBatchVerified'])
        source['sheets']['orders']['formulaRows'] = [['orders-1', '', '', '=0.05*2']]
        report = acceptance(source, archive(source), source)
        self.assertTrue(report['match'])
        self.assertFalse(report['recordValidationPassed'])
        self.assertTrue(report['profile']['problems'])

    def test_cli_writes_exclusive_private_report_and_logs_no_ids_or_financial_values(self):
        source = valid()
        with tempfile.TemporaryDirectory() as directory:
            paths = [Path(directory, name+'.json') for name in ['source', 'archive', 'operational']]
            for path, data in zip(paths, [source, archive(source), source]): path.write_text(json.dumps(data))
            output = Path(directory, 'report.json'); log = io.StringIO()
            with patch('sys.argv', ['acceptance.py', *map(str, paths), '--output', str(output)]), contextlib.redirect_stdout(log):
                self.assertEqual(main(), 0)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertNotIn('orders-1', log.getvalue()); self.assertNotIn('0.10', log.getvalue())
            with patch('sys.argv', ['acceptance.py', *map(str, paths), '--output', str(output)]):
                with self.assertRaises(FileExistsError): main()

    def test_empty_workbook_has_all_tables_and_zero_totals(self):
        source = valid()
        for sheet in source['sheets'].values(): sheet['rows'] = []
        report = acceptance(source, archive(source), source)
        self.assertTrue(report['recordValidationPassed'])
        self.assertTrue(all(t['records']['source']['rows'] == 0 for t in report['tables'].values()))
