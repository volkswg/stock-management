import copy
import json
import unittest
from pathlib import Path
from core import CATALOG, normalize, import_sql, reconcile, convert, exact_total


def fixture():
    snapshot={'version':1,'spreadsheetId':'synthetic-only','sheets':{t:{'headers':list(s['headers']),'rows':[]} for t,s in CATALOG.items()}}
    for table,spec in CATALOG.items():
        row=[]
        for col,kind in spec['columns'].items():
            if col=='id': value=table+'-1'
            elif col in spec['references']: value=spec['references'][col]+'-1'
            elif kind=='numeric': value='0.10'
            elif kind=='bigint': value='1'
            elif kind=='boolean': value='false'
            elif kind=='jsonb': value='{"historical":"preserved"}'
            else: value='historical text'
            row.append(value)
        snapshot['sheets'][table]['rows']=[row]
    return snapshot

class MigrationTests(unittest.TestCase):
    def test_complete_fixture(self):
        self.assertEqual(len(normalize(fixture())),23)
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
    def test_no_numeric_identity_coercion(self):
        f=fixture(); f['sheets']['orders']['rows'][0][0]=123
        with self.assertRaises(ValueError): normalize(f)

if __name__=='__main__': unittest.main()
