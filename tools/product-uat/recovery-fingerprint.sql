-- Supplement the existing full recovery fingerprint AFTER Product Master install.
-- Run inside the SAME read-only exported snapshot as the full dump/fingerprint.
-- Set stock.expected_isolation_id from the approved target. Retain output privately.
SELECT 1/coalesce(current_setting('transaction_read_only')='on',false)::int;
SELECT 1/coalesce((SELECT isolation_id::text=current_setting('stock.expected_isolation_id',true) AND purpose IN ('production','isolated-staging') FROM stock_operational.environment WHERE singleton),false)::int;
SET LOCAL TIME ZONE 'UTC';
WITH hashes AS MATERIALIZED (
 SELECT encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex') AS hash
 FROM stock_operational.products p
)
SELECT json_build_object('table','stock_operational.products','rows',count(*),
 'allRowsIncludingArchived',true,
 'sha256',encode(sha256(convert_to(coalesce(string_agg(hash,'' ORDER BY hash COLLATE "C"),''),'UTF8')),'hex'))
FROM hashes;
SELECT json_build_object('sequence','stock_operational.products_id_seq',
 'lastValue',last_value::text,'isCalled',is_called)
FROM stock_operational.products_id_seq;
