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
print(sql.replace('a.attnum,a.attname,', 'row_number() OVER (PARTITION BY a.attrelid ORDER BY a.attnum) AS attnum,a.attname,'))
print('SELECT to_jsonb(t)::text FROM stock_configuration.loyverse_accounts t ORDER BY id COLLATE "C";')
for table in ['order_bills', 'order_items', 'user_state']:
    print(f'SELECT last_value,is_called FROM stock_operational.{table}_id_seq;')
print('COMMIT;')
