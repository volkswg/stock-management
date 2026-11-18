"""Synthetic-only exact predecessor value and metadata proof; no provider calls."""
import importlib.util
import json
import sys
from pathlib import Path
import recovery
spec = importlib.util.spec_from_file_location('media_catalog', Path(__file__).with_name('media-catalog.py'))
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


def sql():
    # Remove only the five NEW reference fields from existing-row comparisons.
    source = recovery.fingerprint_sql()
    for table, _, ref in catalog.REFERENCES:
        needle = f'WITH serialized AS MATERIALIZED (SELECT to_jsonb(t)::text AS v FROM stock_operational.{table} t)'
        source = source.replace(needle, f'WITH serialized AS MATERIALIZED (SELECT (to_jsonb(t)-\'{ref}\')::text AS v FROM stock_operational.{table} t)')
    return source + "\nSELECT json_build_object('metadata','mediaGlobalRevision','value',(SELECT value::text FROM stock_operational.revision WHERE singleton));"


def records(path):
    return {r.get('table', r.get('metadata')): r for line in path.read_text().splitlines() if line.startswith('{') for r in [json.loads(line)]}


def compare(directory, rollback=False):
    p = Path(directory)
    before = records(p/'media-before.jsonl')
    after = records(p/('media-rollback.jsonl' if rollback else 'media-after.jsonl'))
    for key, item in before.items():
        if key.startswith('stock_') and key != 'stock_operational.revision':
            assert item == after[key], key
    assert int(after['mediaGlobalRevision']['value']) == int(before['mediaGlobalRevision']['value'])+5
    assert len([k for k in before if k.startswith('stock_')]) == 51
    # Old grants, policies, functions and trigger definitions must survive verbatim.
    for section in ['schemas','runtimeRole','runtimeLogins','memberships','defaults','sequenceGrants','sequences']:
        assert before[section] == after[section], section
    for section in ['tables','policies','grants','constraints','indexes','triggers','functions','columns']:
        previous = before[section]['value']; current = after[section]['value']
        assert all(row in current for row in previous), section
        if rollback: assert previous == current, section
    print(json.dumps({'pass':True,'schemaOnlyRollback':rollback,'existingTablesCompared':51,'businessValuesRowsRevisionsTimestampsExact':True,'originalSecurityAndGuardsPreserved':True,'onlyGlobalStatementCounterAdvances':True}))


if __name__ == '__main__':
    if sys.argv[1] == 'sql': print(sql())
    else: compare(sys.argv[2], sys.argv[1] == 'rollback')
