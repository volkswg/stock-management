"""Synthetic socket-only recovery query for the explicit table-absent layout."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'migration'))
from recovery import fingerprint_sql, history_guard_sql

print("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;")
print("SELECT 1 / (inet_client_addr() IS NULL AND session_user='postgres' AND current_database() IN ('np_payments_retired','np_payments_retired_restore'))::int;")
print(history_guard_sql('revision', True, True))
print("SELECT 1 / (stock_operational.receipt_payment_storage_v1()='receipt-payments-jsonb-v1')::int;")
# A logical restore compacts dropped physical attribute slots. Compare the exact
# ordered visible columns, types, defaults and ACLs; physical attnum holes are not
# portable schema state. Production recovery fingerprints remain unchanged.
sql = fingerprint_sql('revision', True, True)
assert sql.count('a.attnum,a.attname,') == 1
sql = sql.replace('a.attnum,a.attname,', 'row_number() OVER (PARTITION BY a.attrelid ORDER BY a.attnum) AS attnum,a.attname,')
# PostgreSQL reparses this historical CHECK during logical restore and flattens
# one associative AND group. Bind both complete known definitions, not a blanket
# parenthesis rewrite. Other constraints, validation flags and drift stay exact.
media_original = 'CHECK ((((EXTRACT(year FROM "createdAt") >= (1)::numeric) AND (EXTRACT(year FROM "createdAt") <= (9999)::numeric)) AND ((EXTRACT(year FROM "updatedAt") >= (1)::numeric) AND (EXTRACT(year FROM "updatedAt") <= (9999)::numeric)) AND (("deletedAt" IS NULL) OR ((EXTRACT(year FROM "deletedAt") >= (1)::numeric) AND (EXTRACT(year FROM "deletedAt") <= (9999)::numeric)))))'
media_reparsed = 'CHECK (((EXTRACT(year FROM "createdAt") >= (1)::numeric) AND (EXTRACT(year FROM "createdAt") <= (9999)::numeric) AND ((EXTRACT(year FROM "updatedAt") >= (1)::numeric) AND (EXTRACT(year FROM "updatedAt") <= (9999)::numeric)) AND (("deletedAt" IS NULL) OR ((EXTRACT(year FROM "deletedAt") >= (1)::numeric) AND (EXTRACT(year FROM "deletedAt") <= (9999)::numeric)))))'
quote = lambda text: "'" + text.replace("'", "''") + "'"
assert sql.count('pg_get_constraintdef(oid) AS definition') == 1
sql = sql.replace('pg_get_constraintdef(oid) AS definition',
    "CASE WHEN conrelid='stock_operational.media'::regclass AND conname='media_dates' AND pg_get_constraintdef(oid)=" + quote(media_original) +
    " THEN " + quote(media_reparsed) + " ELSE pg_get_constraintdef(oid) END AS definition")
# Independently evaluate both actual CHECK expressions over NULL, infinity and
# finite year-boundary cases using PostgreSQL's three-valued timestamp semantics.
original_expression = media_original.removeprefix('CHECK ')
reparsed_expression = media_reparsed.removeprefix('CHECK ')
print("WITH dates(value) AS (VALUES (NULL::timestamptz),('-infinity'::timestamptz),('infinity'::timestamptz),('0001-01-01 BC'::timestamptz),('0001-01-01 AD'::timestamptz),('9999-12-31 23:59:59+00'::timestamptz),('10000-01-01 00:00:00+00'::timestamptz)) SELECT 1/bool_and((" + original_expression + ") IS NOT DISTINCT FROM (" + reparsed_expression + "))::int FROM (SELECT a.value AS \"createdAt\",b.value AS \"updatedAt\",c.value AS \"deletedAt\" FROM dates a CROSS JOIN dates b CROSS JOIN dates c) t;")
print(sql)
print('SELECT to_jsonb(t)::text FROM stock_configuration.loyverse_accounts t ORDER BY id COLLATE "C";')
for table in ['order_bills', 'order_items', 'user_state']:
    print(f'SELECT last_value,is_called FROM stock_operational.{table}_id_seq;')
print('COMMIT;')
