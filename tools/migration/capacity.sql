-- Read-only structural evidence. Set an approved PGSERVICE; contains no business rows.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT now() AS measured_at, version(), pg_database_size(current_database()) AS database_bytes;
SELECT isolation_id,purpose FROM stock_operational.environment;
SELECT n.nspname AS schema,c.relname AS relation,pg_total_relation_size(c.oid) AS total_bytes,
 pg_relation_size(c.oid) AS heap_bytes,pg_indexes_size(c.oid) AS index_bytes,c.reltuples::bigint AS estimated_rows
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('stock_migration','stock_operational') AND c.relkind='r' ORDER BY 1,2;
SELECT schemaname,relname,n_live_tup,n_dead_tup,last_analyze,last_autoanalyze FROM pg_stat_user_tables
WHERE schemaname IN ('stock_migration','stock_operational') ORDER BY 1,2;
SELECT state,count(*) FROM pg_stat_activity WHERE datname=current_database() GROUP BY state;
COMMIT;
