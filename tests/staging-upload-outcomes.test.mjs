import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
function fixture() {
  const effects = new Map(), commands = new Map(), files = [], deletions = [], exports = {};
  let tail = Promise.resolve(), ackLost = false, checkUnavailable = false, failFinish = false;
  class PersistenceFailure extends Error { constructor(status = 503, message = 'Storage unavailable') { super(message); this.status = status; } }
  const client = { async query(sql, values) {
    if (sql.startsWith('SELECT intent,state FROM')) { if (checkUnavailable) throw new PersistenceFailure(); const command = commands.get(values[2]); return { rowCount: command ? 1 : 0, rows: command ? [command] : [] }; }
    if (sql.startsWith('SELECT key,state FROM')) return { rows: [...effects].filter(([key]) => key.startsWith(values[0].slice(0, -1))).map(([key, state]) => ({ key, state })) };
    if (sql.startsWith('INSERT INTO')) { assert.ok(!effects.has(values[0])); effects.set(values[0], 'sending'); return {}; }
    assert.ok(sql.startsWith('UPDATE stock_operational.side_effects')); if (failFinish) throw new PersistenceFailure();
    assert.equal(effects.get(values[0]), 'sending'); effects.set(values[0], values[1]); return {};
  } };
  const database = { PersistenceFailure, currentTransaction: () => client, requireMutation: () => client, async transaction(_write, run) {
    const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
    try { return await run(); } finally { release(); }
  } };
  const commandTransport = {
    hashIntent: value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),
    async executeCommand(_kind, key, intent, run) {
      const existing = commands.get(key); if (existing) return existing.result;
      const result = await run(); commands.set(key, { state: 'complete', intent, result });
      if (ackLost) throw new PersistenceFailure(); return result;
    },
  };
  const source = ts.transpileModule(readFileSync('src/infrastructure/persistence/postgres/uploads.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(source).runInNewContext({ exports, console: { error() {} }, setTimeout, Date, Map, Promise, require(spec) {
    if (spec === 'server-only') return {};
    if (spec === 'node:async_hooks') return { AsyncLocalStorage };
    if (spec === 'node:crypto') return crypto;
    if (spec === './database') return database;
    assert.equal(spec, './commands'); return commandTransport;
  } });
  const drive = { async uploadImage() { const id = 'WT_FILE_' + (files.length + 1); files.push(id); return { id, name: id, webViewLink: 'http://WT/' + id }; }, async deleteFile(id) { deletions.push(id); }, async checkConnection() {}, async makeFileReadableByLink() {} };
  const run = operation => exports.executeUploadCommand('PATCH:/WT', 'WT_upload_key', 'a'.repeat(64), operation);
  return { ...exports, drive, run, files, deletions, effects, commands, setAckLost: () => { ackLost = true; }, setCheckUnavailable: () => { checkUnavailable = true; }, setFinishFailure: () => { failFinish = true; } };
}
test('rollback after the handler returned compensates the accepted new file', async () => {
  const f = fixture(); await assert.rejects(f.run(async () => { await f.observeStagingDrive(f.drive).uploadImage({}); throw Error('WT finalization failed'); }));
  assert.deepEqual(f.deletions, ['WT_FILE_1']); assert.deepEqual([...f.effects.values()], ['done']);
  assert.equal(await f.run(async () => { await f.observeStagingDrive(f.drive).uploadImage({}); return 'saved'; }), 'saved');
  assert.equal(f.files.length, 2);
});
test('provider acceptance with no returned identity leaves a durable uncertain claim and blocks retry', async () => {
  const f = fixture(), original = f.drive.uploadImage; f.drive.uploadImage = async () => { await original(); throw Error('WT acknowledgement lost'); };
  await assert.rejects(f.run(() => f.observeStagingDrive(f.drive).uploadImage({})));
  assert.deepEqual([...f.effects.values()], ['uncertain']);
  await assert.rejects(f.run(() => f.observeStagingDrive(f.drive).uploadImage({})), e => e.status === 503 && /reconciliation/.test(e.message));
  assert.equal(f.files.length, 1); assert.equal(f.deletions.length, 0);
});
test('lost database COMMIT acknowledgement preserves a committed file and replays exactly', async () => {
  const f = fixture(); f.setAckLost();
  await assert.rejects(f.run(async () => { await f.observeStagingDrive(f.drive).uploadImage({}); return 'saved'; }));
  assert.equal(f.deletions.length, 0); assert.equal(f.commands.size, 1);
  assert.equal(await f.run(() => assert.fail('Committed upload executed again')), 'saved'); assert.equal(f.files.length, 1);
});
test('unavailable outcome check never guesses rollback or deletes a possibly committed file', async () => {
  const f = fixture();
  await assert.rejects(f.run(async () => { await f.observeStagingDrive(f.drive).uploadImage({}); f.setCheckUnavailable(); throw Error('WT failure'); }));
  assert.equal(f.deletions.length, 0); assert.deepEqual([...f.effects.values()], ['uncertain']);
});
test('cleanup failure blocks another upload and preserves the original failure', async () => {
  const f = fixture(), marker = Error('WT save failed'); f.drive.deleteFile = async () => { throw Error('WT delete outcome unknown'); };
  await assert.rejects(f.run(async () => { await f.observeStagingDrive(f.drive).uploadImage({}); throw marker; }), e => e === marker);
  assert.deepEqual([...f.effects.values()], ['uncertain']); await assert.rejects(f.run(() => assert.fail('Unsafe resend')), e => e.status === 503);
});
test('already attempted cleanup is never blindly repeated by outer rollback handling', async () => {
  const f = fixture(); let attempts = 0; f.drive.deleteFile = async () => { attempts++; throw Error('WT delete response lost'); };
  await assert.rejects(f.run(async () => { const drive = f.observeStagingDrive(f.drive), file = await drive.uploadImage({}); await drive.deleteFile(file.id); }));
  assert.equal(attempts, 1); assert.deepEqual([...f.effects.values()], ['uncertain']);
});
test('changed input conflicts even when an earlier attempt has an unknown provider outcome', async () => {
  const f = fixture(); await assert.rejects(f.run(async () => { f.drive.uploadImage = async () => { throw Error('WT unknown'); }; await f.observeStagingDrive(f.drive).uploadImage({}); }));
  await assert.rejects(f.executeUploadCommand('PATCH:/WT', 'WT_upload_key', 'b'.repeat(64), () => assert.fail('Changed intent executed')), e => e.status === 409);
});
test('successful concurrent first requests share the completed result and upload only once', async () => {
  const f = fixture(), operation = async () => { await new Promise(resolve => setTimeout(resolve, 10)); await f.observeStagingDrive(f.drive).uploadImage({}); return 'saved'; };
  assert.deepEqual(await Promise.all([f.run(operation), f.run(operation)]), ['saved', 'saved']); assert.equal(f.files.length, 1); assert.equal(f.effects.size, 1);
});
test('invalid keys are refused before claim or provider access', async () => {
  const f = fixture(); await assert.rejects(f.executeUploadCommand('PATCH:/WT', '!bad!', 'a'.repeat(64), () => assert.fail()), e => e.status === 428); assert.equal(f.effects.size, 0);
});
test('missing provider identity is unresolved and no guessed deletion is attempted', async () => {
  const f = fixture(); f.drive.uploadImage = async () => ({ id: '', name: 'WT', webViewLink: 'http://WT/unknown' });
  await assert.rejects(f.run(() => f.observeStagingDrive(f.drive).uploadImage({}))); assert.deepEqual([...f.effects.values()], ['uncertain']); assert.equal(f.deletions.length, 0);
});
test('failure to record the outcome leaves the original durable sending claim', async () => {
  const f = fixture(); f.setFinishFailure(); await assert.rejects(f.run(async () => { await f.observeStagingDrive(f.drive).uploadImage({}); throw Error('WT save failed'); })); assert.deepEqual([...f.effects.values()], ['sending']); assert.equal(f.deletions.length, 1);
});
