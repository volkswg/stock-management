"""Synthetic compact snapshot import/capture/restore oracle. CI fixture DBs only."""
import argparse
import json
from pathlib import Path
from core import canonical,digest,quote
from test_migration import fixture
from snapshot_encoding import COMPACT,encode_snapshot
from jsonb_stream import read_session,verify_snapshot
from recovery import fingerprint_sql

TABLE='public.compact_snapshot_fixture'

class FixtureSession:
    def __init__(self,session):self.session=session
    def rows(self,sql):return self.session.rows(sql.replace('stock_migration.import_batches',TABLE))


def main(restore, expected_path):
    database='recovery_fingerprint_restore' if restore else 'recovery_fingerprint_test'
    begin="BEGIN;SET LOCAL statement_timeout='120s';SET LOCAL standard_conforming_strings=on;SET LOCAL client_encoding='UTF8';SELECT 1/(current_database()="+quote(database)+" AND session_user='postgres' AND inet_client_addr() IS NULL AND current_setting('server_version_num')::int BETWEEN 170000 AND 179999)::int;"
    # Millions of small JSON values reproduce the parser-heavy shape; none are
    # business/provider data. Decompression/equality runs on the operator host.
    source=fixture()
    source['sourceExtensions']={'syntheticLargeMatrix':[['x'*30]*24 for _ in range(100000)]}
    source['sheets']['orders']['formulaRows']=[['=SUM(A2:A4)','ไทย 😀']]
    source_bytes=len(canonical(source).encode('utf8'))
    with read_session(begin) as session:
        if not restore:
            encoded=encode_snapshot(source,COMPACT)
            encoded_bytes=len(canonical(encoded).encode('utf8'))
            assert source_bytes>75*1024*1024 and encoded_bytes<2*1024*1024,'synthetic codec transport bound failed'
            session.rows('CREATE TABLE '+TABLE+'(checksum text PRIMARY KEY,workbook text NOT NULL,snapshot jsonb NOT NULL,imported_at timestamptz NOT NULL);')
            session.rows('INSERT INTO '+TABLE+' VALUES ('+quote(digest(source))+','+quote(source['spreadsheetId'])+','+quote(canonical(encoded))+"::jsonb,'2026-01-01T00:00:00Z');")
        verify_snapshot(FixtureSession(session),source)
        physical=session.table_fingerprint(TABLE)
        oracle=fingerprint_sql().splitlines()[0].replace('stock_migration.import_batches',TABLE)
        assert physical==json.loads(b''.join(session.rows(oracle))),'physical compact row differs from unchanged SQL hash contract'
        if restore:
            expected=json.loads(expected_path.read_text())
            assert expected['physicalFingerprint']==physical and expected['sourceDigest']==digest(source),'independent compact restore mismatch'
        else:
            expected_path.write_text(json.dumps({'physicalFingerprint':physical,'sourceDigest':digest(source),'uncompressedBytes':source_bytes,'storedBytes':encoded_bytes},indent=2)+'\n')
    print('PASS: '+('independently restored' if restore else 'captured source for')+' complete synthetic compact snapshot, unchanged SQL fingerprint and full decoded field equality')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--restore',action='store_true');parser.add_argument('--expected',type=Path,required=True)
    args=parser.parse_args();main(args.restore,args.expected)
