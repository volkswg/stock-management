"""Generate synthetic fingerprint compatibility/memory checks for a socket-only DB."""
from recovery import fingerprint_sql


def legacy_query():
    # Freeze the pre-fix algorithm as the compatibility oracle, not the new SQL.
    return """SELECT json_build_object('table','stock_migration.import_batches','rows',count(*),
      'sha256',encode(sha256(convert_to(coalesce(string_agg(
      length(v::text)::text||':'||v::text,'' ORDER BY v::text COLLATE "C"),''),'UTF8')),'hex'))
      FROM (SELECT to_jsonb(t) v FROM stock_migration.import_batches t) s"""


def generate_sql():
    current = fingerprint_sql().splitlines()[0].removesuffix(';')
    compare = f"""WITH expected AS ({legacy_query()}), actual AS ({current})
      SELECT 1 / ((SELECT pg_catalog.to_jsonb(expected) FROM expected)
        = (SELECT pg_catalog.to_jsonb(actual) FROM actual))::int;"""
    return '\n'.join([
        "\\set ON_ERROR_STOP on",
        "SELECT 1 / (current_database()='recovery_fingerprint_test' AND inet_client_addr() IS NULL AND session_user='postgres' AND current_setting('server_version_num')::int BETWEEN 170000 AND 179999)::int;",
        "SET statement_timeout='120s'; SET work_mem='4MB';",
        "BEGIN; CREATE SCHEMA stock_migration; CREATE TABLE stock_migration.import_batches(id text, snapshot jsonb);",
        compare,
        f"WITH actual AS ({current}) SELECT 1 / ((actual.json_build_object->>'rows')::int=0 AND actual.json_build_object->>'sha256'='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')::int FROM actual;",
        "\\echo recovery-fingerprint: empty table matches the prior fingerprint",
        r"""INSERT INTO stock_migration.import_batches VALUES
        ('ไทย 😀', '{"nested":{"null":null,"string":"null","bool":false},"money":9007199254740993.01,"array":[1,2,"é"]}'),
        ('é', '{"b":2,"a":1}'), ('é', '{"a":1,"b":2}'),
        ('Z', '[]'), ('a', 'null'), ('', '"quoted"'),
        (NULL, NULL), (E'line\nquote\'slash\\', '{"text":"colon:and\nnewline"}');""",
        compare,
        "\\echo recovery-fingerprint: Unicode, duplicates, nulls, exact numerics and C ordering match the prior fingerprint",
        # A STABLE probe allows the old subquery to be inlined just like to_jsonb.
        # Only its synthetic sequence has side effects; no catalog function is changed.
        "CREATE SCHEMA fingerprint_probe; CREATE SEQUENCE fingerprint_probe.calls;",
        """CREATE FUNCTION fingerprint_probe.to_jsonb(value anyelement) RETURNS jsonb
        LANGUAGE plpgsql STABLE AS $probe$
        BEGIN
          PERFORM nextval('fingerprint_probe.calls');
          RETURN pg_catalog.to_jsonb(value);
        END $probe$;""",
        "SET LOCAL search_path=fingerprint_probe,pg_catalog;",
        "CREATE TEMP TABLE probe_before AS SELECT nextval('fingerprint_probe.calls') AS value;",
        current+';',
        "SELECT 1 / ((SELECT nextval('fingerprint_probe.calls')-value-1 FROM probe_before)=(SELECT count(*) FROM stock_migration.import_batches))::int;",
        "\\echo recovery-fingerprint: to_jsonb executes exactly once per row",
        "ROLLBACK;",
        # This fixture is 96 MiB before JSON framing. Do not run the memory-heavy
        # legacy expression here; compatibility is checked above on small cases.
        "BEGIN; CREATE SCHEMA stock_migration; CREATE TABLE stock_migration.import_batches(id text,snapshot jsonb);",
        "INSERT INTO stock_migration.import_batches VALUES ('synthetic-large',jsonb_build_object('payload',repeat('x',96*1024*1024),'money',9007199254740993.01));",
        # For a single row an independent scalar expression needs no aggregate,
        # sort or row-count calculation. Serialize once and retain its expected hash.
        """CREATE TEMP TABLE scalar_expected AS WITH text_row AS MATERIALIZED (
          SELECT pg_catalog.to_jsonb(t)::text AS value FROM stock_migration.import_batches t)
          SELECT encode(sha256(convert_to(length(value)::text||':'||value,'UTF8')),'hex') AS sha256
          FROM text_row;""",
        f"WITH actual AS ({current}) SELECT 1 / ((actual.json_build_object->>'rows')::int=1 AND actual.json_build_object->>'sha256'=(SELECT sha256 FROM scalar_expected))::int FROM actual;",
        "\\echo recovery-fingerprint: 96MiB JSONB fingerprint matches scalar oracle under the container memory cap",
        "ROLLBACK;",
    ])


if __name__ == '__main__':
    print(generate_sql())
