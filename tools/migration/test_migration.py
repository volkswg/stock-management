import copy
import json
import unittest
from pathlib import Path
from core import CATALOG, normalize, import_sql, reconcile, convert, exact_total, load_json, canonical, literal
from decimal import Decimal


def fixture():
    snapshot={'version':1,'spreadsheetId':'synthetic-only','sheets':{t:{'headers':list(s['headers']),'rows':[]} for t,s in CATALOG.items()}}
    for table,spec in CATALOG.items():
        row=[]
        for col,kind in spec['columns'].items():
            if col=='id': value=table+'-1'
            elif col in spec['references']: value=spec['references'][col]+'-1'
            elif col in spec.get('externalReferences',{}): value='account-synthetic'
            elif kind=='numeric': value='0.10'
            elif kind=='bigint': value='1'
            elif kind=='boolean': value='false'
            elif kind=='jsonb': value='{"historical":"preserved"}'
            else: value='historical text'
            row.append(value)
        snapshot['sheets'][table]['rows']=[row]
    return snapshot

def precision_fixture():
    snapshot=fixture()
    for table,spec in CATALOG.items():
        for column,kind in spec['columns'].items():
            if kind=='jsonb':
                snapshot['sheets'][table]['rows'][0][spec['headers'].index(column)]='{"historical":"preserved","totalPay":9007199254740993.01,"tiny":0.10000000000000000000001}'
    return snapshot

class MigrationTests(unittest.TestCase):
    def test_complete_fixture(self):
        self.assertEqual(len(normalize(fixture())),23)
    def test_timesheet_preserves_external_loyverse_account_id_without_shop_master(self):
        source=fixture()
        source['sheets']['shops']['rows']=[]
        source['sheets']['expenses']['rows']=[]
        source['sheets']['employee_advances']['rows']=[]
        sheet=source['sheets']['employee_timesheets']
        column=sheet['headers'].index('shopId')
        sheet['rows'][0][column]='account-attendance-synthetic'
        original=copy.deepcopy(source)
        self.assertEqual(normalize(source)['employee_timesheets'][0]['shopId'],'account-attendance-synthetic')
        self.assertIn("'account-attendance-synthetic'",import_sql(source))
        self.assertEqual(source,original)
        self.assertEqual(CATALOG['employee_timesheets'].get('externalReferences'),{'shopId':'loyverse_accounts.id'})

    def test_timesheet_still_rejects_missing_employee(self):
        source=fixture();source['sheets']['employees']['rows']=[]
        source['sheets']['employee_compensations']['rows']=[]
        with self.assertRaisesRegex(ValueError,'employee_timesheets:2: orphan employeeId'): normalize(source)

    def test_expense_shop_relationship_is_still_internal(self):
        source=fixture();source['sheets']['shops']['rows']=[]
        source['sheets']['employee_advances']['rows']=[]
        with self.assertRaisesRegex(ValueError,'expenses:2: orphan shopId'): normalize(source)

    def test_exact_decimals(self):
        self.assertEqual(convert('9007199254740993.01','numeric'),'9007199254740993.01')
        for value in ('NaN','Infinity','1,200',True):
            with self.assertRaises(ValueError): convert(value,'numeric')
    def test_large_total_is_exact(self):
        self.assertEqual(exact_total(['99999999999999999999999999999999999999.99', '0.01']), '100000000000000000000000000000000000000.00')
    def test_duplicate(self):
        f=fixture(); f['sheets']['orders']['rows']*=2
        with self.assertRaises(ValueError): normalize(f)
    def test_orphan(self):
        f=fixture(); f['sheets']['orders']['rows']=[]
        with self.assertRaises(ValueError): normalize(f)
    def test_schema_drift(self):
        f=fixture(); f['sheets']['orders']['headers'][0]='changed'
        with self.assertRaises(ValueError): normalize(f)
    def test_reconcile_same(self):
        self.assertTrue(reconcile(fixture(),fixture())['match'])
    def test_reconcile_money(self):
        f=fixture(); f['sheets']['orders']['rows'][0][3]='0.11'
        self.assertFalse(reconcile(fixture(),f)['match'])
    def test_compensation_history(self):
        f=fixture(); f['sheets']['employee_compensations']['rows']*=2
        self.assertEqual(len(normalize(f)['employee_compensations']),2)
    def test_sql_safe_and_repeatable(self):
        f=fixture(); f['sheets']['orders']['rows'][0][4]="O'Brien $verify$ \\"
        sql=import_sql(f)
        self.assertIn("O''Brien $verify$",sql)
        self.assertNotIn('DO $verify$',sql)
        self.assertEqual(sql,import_sql(f))
        self.assertIn('ON CONFLICT DO NOTHING',sql)
        self.assertNotIn('UPDATE stock_migration',sql)
    def test_assertions_locate_identity_and_keep_every_original_comparison(self):
        source=fixture(); data=normalize(source); sql=import_sql(source)
        for table,rows in data.items():
            spec=CATALOG[table]; key=spec['key']
            values=dict(rows[0],source_workbook=source['spreadsheetId'])
            kinds=dict(spec['columns'],migration_id='text',source_row='bigint',source_cells='jsonb',source_workbook='text')
            assertion=next(line for line in sql.splitlines() if f'EXISTS (SELECT 1 FROM stock_migration.{table} WHERE ' in line)
            self.assertIn(f'WHERE "{key}" = {literal(values[key],kinds[key])} AND ',assertion)
            for column,value in values.items():
                self.assertIn(f'"{column}" IS NOT DISTINCT FROM {literal(value,kinds[column])}',assertion)
    def test_empty_identity_is_rejected_before_indexed_assertion_generation(self):
        for value in (None,''):
            source=fixture();source['sheets']['orders']['rows'][0][0]=value
            with self.assertRaisesRegex(ValueError,'missing/duplicate identity'):
                import_sql(source)
    def test_no_numeric_identity_coercion(self):
        f=fixture(); f['sheets']['orders']['rows'][0][0]=123
        with self.assertRaises(ValueError): normalize(f)
    def test_nul_text_and_nonfinite_json_are_rejected_instead_of_rewritten(self):
        with self.assertRaises(ValueError):convert('original\x00identity','text')
        for value in ['{"amount":NaN}','{"amount":Infinity}',{'amount':float('nan')}]:
            with self.assertRaises(ValueError):convert(value,'jsonb')
    def test_historical_payroll_json_numbers_keep_exact_precision_and_number_types(self):
        text='{"totalPay":9007199254740993.01,"nested":{"tax":0.10000000000000000000001},"note":"original"}'
        value=convert(text,'jsonb')
        self.assertEqual(value['totalPay'],Decimal('9007199254740993.01'))
        encoded=canonical(value)
        self.assertIn('"totalPay":9007199254740993.01',encoded)
        self.assertNotIn('"9007199254740993.01"',encoded)
        self.assertEqual(load_json(encoded),value)
        self.assertIn('9007199254740993.01',literal(value,'jsonb'))
    def test_native_json_numeric_cells_do_not_pass_through_binary_float(self):
        source=load_json('{"amount":9007199254740993.01}')
        self.assertEqual(convert(source['amount'],'numeric'),'9007199254740993.01')

if __name__=='__main__': unittest.main()
