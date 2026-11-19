"""Compare all52 tables and exact allowed schema/permission deltas locally."""
import json
import runpy
import sys
from pathlib import Path
import recovery

M = runpy.run_path(str(Path(__file__).with_name('soft-delete.py')))


def sql():
    text = recovery.fingerprint_sql(include_media=True)
    for table in M['TABLES']:
        old = f'WITH serialized AS MATERIALIZED (SELECT to_jsonb(t)::text AS v FROM stock_operational.{table} t)'
        normalized = "((to_jsonb(t)-'archived_at') || jsonb_build_object('deletedAt',coalesce(nullif(to_jsonb(t)->'deletedAt','null'::jsonb),to_jsonb(t)->'archived_at','null'::jsonb)))"
        assert text.count(old) == 1
        text = text.replace(old, f'WITH serialized AS MATERIALIZED (SELECT {normalized}::text AS v FROM stock_operational.{table} t)')
    return text


def compare(directory):
    def read(name):
        return {r.get('table', r.get('metadata')): r for line in (directory / name).read_text().splitlines() if line.startswith('{') for r in [json.loads(line)]}
    before, after = read('soft-delete-before.jsonl'), read('soft-delete-after.jsonl')
    tables = [k for k in before if k.startswith('stock_')]
    assert len(tables) == 52
    for k in tables:
        assert before[k] == after[k], k
    for k in ['schemas', 'runtimeRole', 'runtimeLogins', 'memberships', 'defaults', 'tables', 'policies', 'grants', 'sequences', 'sequenceGrants', 'triggers']:
        assert before[k] == after[k], k
    expected = []
    for col in before['columns']['value']:
        col = dict(col)
        if col['nspname'] == 'stock_operational' and col['attname'] == 'archived_at':
            if col['relname'] in M['EXISTING']:
                continue
            col['attname'] = 'deletedAt'
        expected.append(col)
    assert after['columns']['value'] == expected
    added = [c for c in after['constraints']['value'] if c not in before['constraints']['value']]
    assert len(added) == 17 and {c['conname'] for c in added} == {t+'_deleted_at_range' for t in M['RENAMED']} and all(c['convalidated'] for c in added)
    assert [c for c in after['constraints']['value'] if c not in added] == before['constraints']['value']
    expected = []
    for index in before['indexes']['value']:
        index = dict(index)
        if index['schemaname'] == 'stock_operational':
            index['indexdef'] = index['indexdef'].replace('archived_at', '"deletedAt"').replace('(("deletedAt" IS NULL) AND ("deletedAt" IS NULL))', '("deletedAt" IS NULL)')
        expected.append(index)
    assert after['indexes']['value'] == expected
    changed = {'prepare_record_write', 'lexeme_mapping_contract_v1'}
    original = {f['proname']: f for f in before['functions']['value'] if f['nspname'] == 'stock_operational'}
    new = {f['proname']: f for f in after['functions']['value'] if f['nspname'] == 'stock_operational'}
    assert set(new) == set(original) | {'soft_delete_contract_v1'}
    for name, definition in original.items():
        assert {k: v for k, v in definition.items() if k != 'definition' or name not in changed} == {k: v for k, v in new[name].items() if k != 'definition' or name not in changed}, name
    assert new['soft_delete_contract_v1']['acl'] == original['lexeme_mapping_contract_v1']['acl']
    assert new['soft_delete_contract_v1']['owner'] == original['lexeme_mapping_contract_v1']['owner']
    inverse = read('soft-delete-inverse.jsonl')
    for k in tables:
        assert inverse[k] == before[k], k
    # Restoring six dropped columns may change their physical attribute slots.
    for k in set(before) - set(tables) - {'columns'}:
        assert inverse[k] == before[k], k
    key = lambda c: (c['nspname'], c['relname'], c['attname'])
    strip = lambda c: {k: v for k, v in c.items() if k != 'attnum'}
    assert {key(c): strip(c) for c in inverse['columns']['value']} == {key(c): strip(c) for c in before['columns']['value']}
    print(json.dumps({'pass': True, 'all52Tables': True, 'globalAndRowRevisionsPreserved': True, 'permissionsAndMediaPreserved': True, 'inverseExactExceptPhysicalSlots': True}))


if __name__ == '__main__':
    if sys.argv[1] == 'sql':
        print(sql())
    else:
        compare(Path(sys.argv[1]))
