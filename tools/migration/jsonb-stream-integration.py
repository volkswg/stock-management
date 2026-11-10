"""Synthetic PostgreSQL 17 oracle checks; disposable fixture database only."""
import argparse
import json
import re
from core import canonical,digest,quote
from jsonb_stream import read_session,jsonb_fragments,batch_fingerprint,verify_snapshot
from recovery import fingerprint_sql
from pg_access import secure_connection_sql

class FixtureSession:
    def __init__(self,session):self.session=session
    def rows(self,sql):return self.session.rows(sql.replace('stock_migration.import_batches','pg_temp.sm_stream_batches'))


def main(database="recovery_fingerprint_test"):
    if database!="recovery_fingerprint_test" and not re.fullmatch(r"stock_free_compat_[0-9]{8}_[0-9]{2}",database):raise ValueError("disposable local fixture database required")
    begin="BEGIN;SET LOCAL statement_timeout='120s';SET LOCAL standard_conforming_strings=on;SET LOCAL client_encoding='UTF8';"+secure_connection_sql()+"SELECT 1/(current_database()="+quote(database)+" AND session_user='postgres')::int;"
    with read_session(begin) as session:
        session.rows('CREATE TEMP TABLE sm_stream_batches(checksum text PRIMARY KEY,workbook text NOT NULL,snapshot jsonb NOT NULL,imported_at timestamptz NOT NULL) ON COMMIT DROP;')
        fixture=FixtureSession(session)
        oracle=fingerprint_sql().splitlines()[0].replace('stock_migration.import_batches','pg_temp.sm_stream_batches')
        for value in ['null','{}','[]','true','false','0.1000','9007199254740993.01',r'{"nested":[{},[],null,false,"ไทย 😀"],"x":"\u0001\b\f\n\r\t\\\"/","é":1,"abc":2}']:
            relation='(SELECT '+quote(value)+'::jsonb AS value) AS synthetic'
            expected=b''.join(session.rows('SELECT value::text FROM '+relation+';')).decode().removesuffix('\n')
            actual=''.join(jsonb_fragments(session,'value',relation))
            assert actual==expected,'synthetic JSONB text mismatch'
        for expression in ["(SELECT jsonb_agg(i%7 ORDER BY i) FROM generate_series(1,4097) AS i)","jsonb_build_object('unicode',repeat('ไทย😀',300000))"]:
            session.rows("INSERT INTO sm_stream_batches VALUES (repeat('f',64),'synthetic-only',"+expression+",'2026-01-01T00:00:00Z');")
            expected=json.loads(b''.join(session.rows(oracle)));expected['table']='stock_migration.import_batches'
            assert batch_fingerprint(fixture)==expected,'batch hash differs from original SQL'
            actual=session.table_fingerprint('pg_temp.sm_stream_batches');actual['table']='stock_migration.import_batches'
            assert actual==expected,'streamed table hash differs from original SQL'
            # Only disposable synthetic fixture rows are removed by this runner.
            session.rows('DELETE FROM sm_stream_batches;')
        for checksum,value in [('f','{}'),('0','[]'),('a','{"nested":[{},null,true,0.100,9007199254740993.01,"ไทย 😀"]}')]:
            session.rows("INSERT INTO sm_stream_batches VALUES (repeat('"+checksum+"',64),'synthetic-only',"+quote(value)+"::jsonb,'2026-01-01T00:00:00Z');")
        expected=json.loads(b''.join(session.rows(oracle)));expected['table']='stock_migration.import_batches'
        assert batch_fingerprint(fixture)==expected,'C-order multi-batch hash mismatch'
        session.rows('CREATE TEMP TABLE sm_stream_duplicates(id text,value jsonb) ON COMMIT DROP;')
        session.rows("INSERT INTO sm_stream_duplicates VALUES ('é','null'),('é','null'),('ไทย 😀','{\"a\":9007199254740993.01}'),('Z','false'),(null,null);")
        duplicate_oracle=fingerprint_sql().splitlines()[0].replace('stock_migration.import_batches','pg_temp.sm_stream_duplicates')
        assert session.table_fingerprint('pg_temp.sm_stream_duplicates')==json.loads(b''.join(session.rows(duplicate_oracle))),'duplicates or null fingerprint mismatch'
        source={'spreadsheetId':'synthetic-only','sheets':{'orders':{'formulaRows':[['=A2']],'rawRows':[[False,1,None]]}},'sourceExtensions':{'preserved':'legacy'}}
        session.rows("INSERT INTO sm_stream_batches VALUES ("+quote(digest(source))+",'synthetic-only',"+quote(canonical(source))+"::jsonb,'2026-01-01T00:00:00Z');")
        verify_snapshot(fixture,source)
        session.rows("UPDATE sm_stream_batches SET snapshot=jsonb_set(snapshot,'{sheets,orders,formulaRows,0,0}','\"=B2\"') WHERE checksum="+quote(digest(source))+';')
        try:verify_snapshot(fixture,source)
        except ValueError:pass
        else:raise AssertionError('changed formula passed complete snapshot binding')
    print('PASS: original SQL oracle, exact JSONB text, Unicode chunks, arrays, C order, duplicates, nulls and full formula binding')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--database',default='recovery_fingerprint_test');main(parser.parse_args().database)
