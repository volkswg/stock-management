import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from recovery import capture, checksum, fingerprint_sql, guard_sql, verify
from staging import EXPECTED_TARGET, deployment_plan, inspect_sql
from pg_access import client_environment


class StagingRecoveryTests(unittest.TestCase):
    def test_plugin_or_google_configuration_is_not_implicitly_a_postgres_connection(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaises(ValueError):client_environment()
        with patch.dict(os.environ,{'PGSERVICE':'approved-staging'},clear=True):
            self.assertEqual(client_environment()['PGCONNECT_TIMEOUT'],'10')
    def test_deployment_plan_pins_exact_tokyo_target_and_migration_bytes_without_io(self):
        with patch('subprocess.run', side_effect=AssertionError('no external calls')):
            result = deployment_plan(EXPECTED_TARGET)
        self.assertFalse(result['executionAuthorized']); self.assertFalse(result['productionCutoverAllowed'])
        self.assertEqual(len(result['migrations']), 2)
        for entry in result['migrations']: self.assertEqual(checksum(entry['file']), entry['sha256'])
        commands = '\n'.join(result['steps'])
        self.assertIn('--skip-vault --dry-run', commands)
        self.assertNotIn('--linked', commands)

    def test_wrong_region_project_or_production_target_cannot_generate_deployment_plan(self):
        for key, value in [('region', 'ap-southeast-1'), ('purpose', 'production'), ('projectId', 'other-project'), ('productionWritesAllowed', True)]:
            target = copy.deepcopy(EXPECTED_TARGET); target[key] = value
            with self.assertRaises(ValueError): deployment_plan(target)

    def test_metadata_inspection_reads_catalogs_only(self):
        sql = inspect_sql()
        self.assertTrue(sql.startswith('BEGIN READ ONLY;'))
        for forbidden in ['FROM auth.', 'FROM storage.', 'FROM stock_migration.', 'FROM stock_operational.', 'CREATE ', 'INSERT ', 'UPDATE ', 'DELETE ']:
            self.assertNotIn(forbidden, sql)

    def test_recovery_covers_51_tables_security_triggers_sequences_and_sha256(self):
        sql = fingerprint_sql()
        self.assertEqual(sql.count("'table',"), 51)
        self.assertIn('sha256(', sql)
        for part in ['pg_policies', 'pg_get_constraintdef', 'pg_indexes', 'pg_get_triggerdef', 'pg_get_functiondef', 'pg_sequences', 'pg_default_acl', 'rolbypassrls']:
            self.assertIn(part, sql)
        with self.assertRaises(ValueError): guard_sql("bad';DROP TABLE x;")

    def test_existing_backup_directory_and_invalid_uuid_fail_before_connection(self):
        with tempfile.TemporaryDirectory() as directory, patch('subprocess.Popen', side_effect=AssertionError('no connection')):
            with self.assertRaises(FileExistsError): capture(directory, '00000000-0000-0000-0000-000000000001')
            with self.assertRaises(ValueError): capture(str(Path(directory, 'new')), 'bad-target')

    def test_tampered_dump_fails_verification_before_database_access(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory); (p/'database.dump').write_bytes(b'original'); (p/'fingerprint.json').write_text('[]')
            receipt = {'dumpSha256': checksum(p/'database.dump'), 'fingerprintSha256': checksum(p/'fingerprint.json')}
            (p/'receipt.json').write_text(json.dumps(receipt)); (p/'database.dump').write_bytes(b'changed')
            with patch('subprocess.Popen', side_effect=AssertionError('no connection')):
                with self.assertRaises(ValueError): verify(directory, '00000000-0000-0000-0000-000000000001')
