-- Read-only source witness. Execute in the same full-visibility snapshot as
-- the count audit; keep the result in the private owner execution packet.
WITH rows AS (
 SELECT 'receipts' name,id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') hash
 FROM stock_operational.sales_receipts t
 UNION ALL
 SELECT 'payments',id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')
 FROM stock_operational.sales_receipt_payments t
)
SELECT encode(sha256(convert_to(coalesce(string_agg(jsonb_build_array(name,id,hash)::text,E'\n' ORDER BY name COLLATE "C",id COLLATE "C"),''),'UTF8')),'hex') fingerprint FROM rows;
