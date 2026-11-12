/* eslint-disable @typescript-eslint/no-require-imports -- Existing full recovery capture on an exactly scoped, verified-TLS read-only service. No role or data writes. */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), assert = require('node:assert/strict');
const { requireGate, sha } = require('./policy.cjs');
function compareProtected(before, after) {
  for (const records of [before, after]) {
    requireGate(records.filter(r => r.table).length === 51 && records.filter(r => r.metadata).length === 15, 'FINGERPRINT_COMPLETE_INVENTORY');
    requireGate(records.filter(r => r.table?.startsWith('stock_migration.')).length === 24 && records.filter(r => r.table === 'stock_operational.environment').length === 1, 'FINGERPRINT_PROTECTED_INVENTORY');
  }
  const protectedRecords = records => records.filter(r => r.metadata || r.table?.startsWith('stock_migration.') || r.table === 'stock_operational.environment').sort((a, b) => String(a.table || a.metadata).localeCompare(String(b.table || b.metadata)));
  assert.deepEqual(protectedRecords(after), protectedRecords(before)); return { archiveTables: 24, metadataSections: 15, environmentUnchanged: true };
}
function captureAndCompare(packet, { compareAll = false, directoryName = 'generated-checkpoint' } = {}) {
  const baseline = fs.readFileSync(packet.baselineFingerprintFile); requireGate(sha(baseline) === packet.binding.baselineSha256, 'FINGERPRINT_BASELINE_SEAL');
  // Parse only the declared new-target profile. Require explicit password/passfile so libpq cannot fall back to a home credential file.
  const parser = "import configparser,json,sys\np=configparser.RawConfigParser();p.read(sys.argv[1]);print(json.dumps(dict(p[sys.argv[2]])))";
  const parsed = cp.spawnSync('python3', ['-c', parser, packet.backupServiceFile, packet.backupService], { encoding: 'utf8', env: { PATH: process.env.PATH } }); requireGate(parsed.status === 0, 'FINGERPRINT_SERVICE_FILE');
  const service = JSON.parse(parsed.stdout), binding = packet.binding;
  requireGate(Object.keys(service).every(k => ['host', 'port', 'dbname', 'user', 'password', 'passfile', 'sslmode', 'sslrootcert', 'application_name'].includes(k)), 'FINGERPRINT_SERVICE_OPTIONS');
  requireGate(service.host === binding.databaseHost && service.port === '5432' && service.dbname === 'postgres' && service.sslmode === 'verify-full' && service.user?.startsWith('stock_ha_backup') && (service.password || service.passfile), 'FINGERPRINT_SERVICE_TARGET');
  requireGate(binding.connectionMode === 'session' ? service.user.endsWith('.' + binding.projectRef) : !service.user.includes('.'), 'FINGERPRINT_POOLER_PROJECT');
  requireGate(['generated-checkpoint', 'preflight-checkpoint'].includes(directoryName), 'FINGERPRINT_DIRECTORY'); const directory = path.join(packet.evidenceDirectory, directoryName);
  const result = cp.spawnSync('python3', [path.join(__dirname, '../recovery.py'), 'capture', '--directory', directory, '--target-id', binding.isolationId, '--workers', '2', '--row-digests'], { env: { PATH: process.env.PATH, PGSERVICEFILE: packet.backupServiceFile, PGSERVICE: packet.backupService }, encoding: 'utf8', timeout: 300000 });
  requireGate(result.status === 0, 'FINGERPRINT_CAPTURE');
  const actual = JSON.parse(fs.readFileSync(path.join(directory, 'fingerprint.json'))), expected = JSON.parse(baseline); const proof = compareProtected(expected, actual);
  if (compareAll) assert.deepEqual(actual, expected);
  return { ...proof, generatedCheckpoint: directory };
}
module.exports = { compareProtected, captureAndCompare };
