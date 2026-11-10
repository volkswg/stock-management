"""Synthetic nullable-JSON contract shared by unit and real PostgreSQL checks."""
import copy
import unittest
from core import CATALOG, canonical, convert, normalize
from test_migration import precision_fixture

CASES = [
    ('native-null', None, True),
    ('empty-text', '', True),
    ('text-null', 'null', True),
    ('whitespace-null', ' \nnull\t', True),
    ('native-false', False, False),
    ('native-zero', 0, False),
    ('text-false', 'false', False),
    ('text-zero', '0', False),
    ('empty-array', '[]', False),
    ('empty-object', '{}', False),
    ('quoted-null', '"null"', False),
    ('nested-null', '{"nested":null,"money":9007199254740993.01}', False),
    ('native-object', {'nested': None}, False),
    ('missing-cell', None, True),
]


def nullable_json_fixture():
    source = precision_fixture()
    for table, spec in CATALOG.items():
        columns = [column for column, kind in spec['columns'].items() if kind == 'jsonb']
        if not columns:
            continue
        original = source['sheets'][table]['rows'][0]
        for index, (name, value, _) in enumerate(CASES):
            row = copy.deepcopy(original)
            row[spec['headers'].index('id')] = table + '-json-' + name
            if table == 'payroll_settlements':
                row[spec['headers'].index('month')] = f'{2010 + index // 12}-{index % 12 + 1:02d}'
            if table == 'sales_receipt_payments':
                row[spec['headers'].index('paymentIndex')] = str(index + 2)
            for column in columns:
                row[spec['headers'].index(column)] = copy.deepcopy(value)
            if name == 'missing-cell':
                row = row[:min(spec['headers'].index(column) for column in columns)]
            source['sheets'][table]['rows'].append(row)
    return source


class NullableJsonTests(unittest.TestCase):
    def test_null_forms_match_the_archive_without_changing_source_cells(self):
        source = nullable_json_fixture()
        original = copy.deepcopy(source)
        records = normalize(source)
        for table, spec in CATALOG.items():
            columns = [column for column, kind in spec['columns'].items() if kind == 'jsonb']
            if not columns:
                continue
            by_id = {row['id']: row for row in records[table]}
            for name, value, is_null in CASES:
                row = by_id[table + '-json-' + name]
                for column in columns:
                    if is_null:
                        self.assertIsNone(row[column], (table, column, name))
                    else:
                        self.assertEqual(canonical(row[column]), canonical(convert(value, 'jsonb')),
                                         (table, column, name))
        self.assertEqual(source, original)

    def test_json_string_null_and_nested_null_are_not_sql_null(self):
        self.assertEqual(convert('"null"', 'jsonb'), 'null')
        self.assertEqual(convert('{"nested":null}', 'jsonb'), {'nested': None})
        self.assertEqual(canonical(convert('false', 'jsonb')), 'false')
        self.assertEqual(canonical(convert('0', 'jsonb')), '0')
        self.assertEqual(canonical(convert('[]', 'jsonb')), '[]')
        self.assertEqual(canonical(convert('{}', 'jsonb')), '{}')

    def test_malformed_json_still_fails_instead_of_becoming_null(self):
        for value in ['not-json', ' ', '{broken']:
            with self.assertRaises(ValueError):
                convert(value, 'jsonb')


if __name__ == '__main__':
    unittest.main()
