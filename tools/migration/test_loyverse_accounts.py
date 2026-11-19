import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('accounts', Path(__file__).with_name('loyverse-accounts.py'))
accounts = importlib.util.module_from_spec(spec); spec.loader.exec_module(accounts)

class PrivateAccountImport(unittest.TestCase):
    def fixture(self):
        return {'headers': accounts.HEADERS, 'rows': [
            [' two ', ' Second ', '', ' synthetic-2 ', True, '20'],
            ['off', 'Old', '', '', False, 30],
            ['\ufeffone\ufeff', 'First', ' store ', 'synthetic-1', 'TRUE', 10],
            ['', None, ' '],
        ]}

    def test_exact_normalization_order_disabled_and_optional_store(self):
        value = accounts.normalize(self.fixture())
        self.assertEqual([r['id'] for r in value], ['one', 'two', 'off'])
        self.assertEqual(value[0]['storeId'], 'store')
        self.assertIsNone(value[1]['storeId']); self.assertIsNone(value[2]['accessToken'])
        self.assertEqual(value[1]['accessToken'], 'synthetic-2')

    def test_invalid_and_duplicate_rows_fail_without_reflecting_secrets(self):
        for index, value in [(0,''),(1,''),(2,12),(3,12),(3,''),(4,'yes'),(5,-1),(5,1.5),(5,9007199254740992),(5,True)]:
            fixture=self.fixture(); fixture['rows'][0][index]=value
            with self.subTest(index=index, value=value), self.assertRaises(ValueError) as error: accounts.normalize(fixture)
            self.assertNotIn('synthetic-',str(error.exception))
        for row in [['two','Other','','secret',True,99],['other','Other','','secret',True,20]]:
            fixture=self.fixture(); fixture['rows'].append(row)
            with self.assertRaises(ValueError): accounts.normalize(fixture)
        for fixture in [{}, {'headers':accounts.HEADERS,'rows':[]}, {'headers':accounts.HEADERS[::-1],'rows':self.fixture()['rows']}]:
            with self.assertRaises(ValueError): accounts.normalize(fixture)

    def test_sql_is_target_bound_empty_only_atomic_and_quotes_payload_safely(self):
        fixture=self.fixture();fixture['rows'][0][1]="Shop ' $$ $config_ -- ; \\"
        sql=accounts.import_sql(accounts.normalize(fixture),'11111111-1111-4111-8111-111111111111','production')
        self.assertIn('ACCESS EXCLUSIVE', sql);self.assertIn('Configuration is populated; import refused',sql)
        self.assertIn("purpose='production'",sql); self.assertIn('jsonb_to_recordset(',sql)
        self.assertNotIn('COMMIT',sql)  # Commit only after Python checks every returned field.
        self.assertNotIn('TRUNCATE',sql);self.assertNotIn('DELETE FROM',sql)
        with self.assertRaises(ValueError): accounts.import_sql([], 'wrong', 'production')

if __name__ == '__main__': unittest.main()
