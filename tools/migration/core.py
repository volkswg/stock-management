"""Offline, lossless snapshot validation and append-only PostgreSQL import planning."""
import hashlib
import json
import re
from decimal import Decimal, InvalidOperation, localcontext
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name('worksheets.json').read_text())

def canonical(value):
    # JSONB financial snapshots must retain number semantics and precision.
    # Encoding Decimal as a quoted string would also change historical data.
    if isinstance(value, Decimal):
        if not value.is_finite(): raise ValueError('nonfinite JSON number')
        return str(value)
    if isinstance(value, dict):
        if any(not isinstance(k,str) for k in value): raise ValueError('JSON object keys must be strings')
        return '{'+','.join(canonical(k)+':'+canonical(v) for k,v in sorted(value.items()))+'}'
    if isinstance(value, list): return '['+','.join(canonical(v) for v in value)+']'
    if isinstance(value,str):
        if '\x00' in value: raise ValueError('PostgreSQL cannot preserve NUL in JSON')
        value.encode('utf-8')
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)

def load_json(value):
    def invalid_constant(_): raise ValueError('nonfinite JSON constant')
    return json.loads(value, parse_float=Decimal, parse_constant=invalid_constant)

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

def convert(value, kind):
    if value is None or value == '':
        return None
    if kind == 'text':
        if not isinstance(value, str):
            raise ValueError('text cells must be strings; numeric IDs/dates require review')
        if '\x00' in value:
            raise ValueError('PostgreSQL text cannot preserve NUL bytes')
        value.encode('utf-8')
        return value
    if kind == 'boolean':
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.lower() in ('true', 'false'):
            return value.lower() == 'true'
        raise ValueError('invalid boolean')
    if kind == 'jsonb':
        result = load_json(value) if isinstance(value, str) else value
        canonical(result)  # Reject non-finite JSON; never silently rewrite it.
        return result
    try:
        if isinstance(value, bool) or not re.fullmatch(r'[+-]?\d+(\.\d+)?', str(value)):
            raise ValueError('invalid decimal')
        number = Decimal(str(value))
        if not number.is_finite() or kind == 'bigint' and (number != number.to_integral() or not -(2**63) <= number < 2**63):
            raise ValueError('invalid number')
        return str(number)  # never pass money through a binary floating point calculation
    except InvalidOperation as exc:
        raise ValueError('invalid decimal') from exc

def normalize(snapshot):
    if snapshot.get('version') != 1 or not isinstance(snapshot.get('spreadsheetId'), str) or not snapshot['spreadsheetId']:
        raise ValueError('invalid snapshot envelope')
    if set(snapshot['sheets']) != set(CATALOG):
        raise ValueError('all business worksheets required; unknown sheets rejected')
    result = {}
    for table, spec in CATALOG.items():
        sheet = snapshot['sheets'][table]
        if sheet['headers'] != spec['headers']:
            raise ValueError(f'{table}: header mismatch')
        rows, seen = [], set()
        for number, raw in enumerate(sheet['rows'], 2):
            if not isinstance(raw, list) or len(raw) > len(spec['headers']):
                raise ValueError(f'{table}:{number}: invalid width')
            if all(v in ('', None) for v in raw):
                continue
            cells = raw + [None] * (len(spec['headers']) - len(raw))
            row = {c: convert(v, spec['columns'][c]) for c, v in zip(spec['headers'], cells)}
            if spec['key'] == 'migration_id':
                row['migration_id'] = f'sheet-row:{number}'
            if any(row[col] is None for col in spec.get('required', [])):
                raise ValueError(f'{table}:{number}: missing required relationship')
            key = row[spec['key']]
            if not key or key in seen:
                raise ValueError(f'{table}:{number}: missing/duplicate identity')
            seen.add(key)
            row.update(source_row=number, source_cells=raw)
            rows.append(row)
        result[table] = rows
    for table, spec in CATALOG.items():
        for col, parent in spec['references'].items():
            ids = {r['id'] for r in result[parent]}
            for row in result[table]:
                if row[col] is not None and row[col] not in ids:
                    raise ValueError(f'{table}:{row["source_row"]}: orphan {col}')
    return result

def quote(value):
    return "'" + str(value).replace("'", "''") + "'"

def literal(value, kind):
    if value is None:
        return 'NULL'
    if kind == 'jsonb':
        return quote(canonical(value)) + '::jsonb'
    return quote(str(value).lower() if isinstance(value, bool) else value) + '::' + kind

def import_sql(snapshot, *, snapshot_encoding="plain-jsonb"):
    data = normalize(snapshot)
    batch = digest(snapshot)
    sql = ['BEGIN;', 'SET LOCAL standard_conforming_strings = on;', "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '120s';",
           "SELECT pg_advisory_xact_lock(835107241);", 'SET CONSTRAINTS ALL DEFERRED;']
    # Append-only: an identical row is a no-op; any changed identity aborts the entire transaction.
    for table, rows in data.items():
        spec = CATALOG[table]
        for row in rows:
            values = dict(row, source_workbook=snapshot['spreadsheetId'])
            kinds = dict(spec['columns'], migration_id='text', source_row='bigint', source_cells='jsonb', source_workbook='text')
            cols = ','.join('"'+c+'"' for c in values)
            vals = ','.join(literal(v, kinds[c]) for c,v in values.items())
            sql.append(f'INSERT INTO stock_migration.{table} ({cols}) VALUES ({vals}) ON CONFLICT DO NOTHING;')
            predicates = ' AND '.join(f'"{c}" IS NOT DISTINCT FROM {literal(v,kinds[c])}' for c,v in values.items())
            sql.append(f"SELECT 1 / (EXISTS (SELECT 1 FROM stock_migration.{table} WHERE {predicates}))::int;")
    from snapshot_encoding import encode_snapshot
    stored_snapshot = encode_snapshot(snapshot, snapshot_encoding)
    sql.append(f"INSERT INTO stock_migration.import_batches (checksum,workbook,snapshot) VALUES ({quote(batch)},{quote(snapshot['spreadsheetId'])},{literal(stored_snapshot,'jsonb')}) ON CONFLICT DO NOTHING;")
    sql.append('COMMIT;')
    return '\n'.join(sql)+'\n'

def exact_total(values):
    numbers = [Decimal(v) for v in values if v is not None]
    with localcontext() as context:
        context.prec = max((len(n.as_tuple().digits) + abs(n.as_tuple().exponent) for n in numbers), default=1) * 2 + len(str(len(numbers))) + 10
        return str(sum(numbers, Decimal(0)))

def metrics(snapshot):
    data = normalize(snapshot)
    return {table: {'rows': len(rows), 'ids': sorted(r[CATALOG[table]['key']] for r in rows),
                    'content': digest(sorted(rows, key=lambda r: r[CATALOG[table]['key']])),
                    'totals': {col: exact_total(r[col] for r in rows)
                               for col, kind in CATALOG[table]['columns'].items() if kind in ('numeric','bigint')},
                    'relationships': {col: sorted([r[CATALOG[table]['key']],r[col]] for r in rows if r[col] is not None)
                                      for col in CATALOG[table]['references']}}
            for table, rows in data.items()}

def reconcile(source, target):
    left, right = metrics(source), metrics(target)
    return {'match': left == right, 'differences': {t: {'source': left[t], 'target': right[t]} for t in left if left[t] != right[t]}}
