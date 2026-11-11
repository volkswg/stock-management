import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function fixture(mode = 'supabase', deletionFails = false) {
  const calls = [], warnings = [], marker = new Error('WT storage failed'), exports = {};
  const source = ts.transpileModule(readFileSync('src/composition/staging-upload-cleanup.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(source).runInNewContext({ exports, Response, Set, console: { error: message => warnings.push(message) }, require(spec) {
    if (spec === 'server-only') return {};
    assert.equal(spec, '@/infrastructure/persistence/postgres/database');
    return { storageMode: () => mode, requireMutation: () => calls.push('mutation-guard') };
  } });
  let n = 0;
  const drive = { async uploadImage(input) { calls.push(['upload', input]); return { id: 'WT_FILE_' + (++n), name: 'WT', webViewLink: 'http://WT/' + n }; }, async deleteFile(id) { calls.push(['delete', id]); if (deletionFails) throw marker; }, async checkConnection() {}, async makeFileReadableByLink() {} };
  return { ...exports, drive, calls, warnings, marker };
}
test('staging save failures compensate exactly the newly accepted file IDs', async () => {
  const f = fixture();
  await assert.rejects(f.withStagingUploadCleanup(f.drive, async drive => { await drive.uploadImage({ fileName: 'WT' }); throw f.marker; }), error => error === f.marker);
  assert.deepEqual(f.calls.filter(c => Array.isArray(c) && c[0] === 'delete'), [['delete', 'WT_FILE_1']]);
  assert.equal(f.warnings.length, 0);
});
test('failed HTTP responses compensate without changing their status or body', async () => {
  const f = fixture(), response = Response.json({ error: 'WT rejected' }, { status: 500 });
  const result = await f.withStagingUploadCleanup(f.drive, async drive => { await drive.uploadImage({}); return response; });
  assert.equal(result, response); assert.equal(result.status, 500); assert.equal(f.calls.filter(c => c[0] === 'delete').length, 1);
});
test('successful staging save keeps files and returns the original result', async () => {
  const f = fixture(), response = Response.json({ ok: true });
  assert.equal(await f.withStagingUploadCleanup(f.drive, async drive => { await drive.uploadImage({}); return response; }), response);
  assert.equal(f.calls.filter(c => c[0] === 'delete').length, 0);
});
test('a prior cleanup attempt is not blindly repeated even when its outcome is unknown', async () => {
  const f = fixture('supabase', true);
  await assert.rejects(f.withStagingUploadCleanup(f.drive, async drive => { const file = await drive.uploadImage({}); await drive.deleteFile(file.id); }), error => error === f.marker);
  assert.equal(f.calls.filter(c => c[0] === 'delete').length, 1);
});
test('cleanup failure remains visible without replacing the original save failure', async () => {
  const f = fixture('supabase', true);
  await assert.rejects(f.withStagingUploadCleanup(f.drive, async drive => { await drive.uploadImage({}); throw f.marker; }), error => error === f.marker);
  assert.equal(f.warnings.length, 1); assert.equal(f.calls.filter(c => c[0] === 'delete').length, 1);
});
test('uploads without a returned identity never cause guessed or original-file deletion', async () => {
  const f = fixture(); f.drive.uploadImage = async () => { throw f.marker; };
  await assert.rejects(f.withStagingUploadCleanup(f.drive, drive => drive.uploadImage({})), error => error === f.marker);
  assert.equal(f.calls.filter(c => c[0] === 'delete').length, 0);
  f.drive.uploadImage = async () => ({ id: '', webViewLink: 'http://WT/unknown' });
  await assert.rejects(f.withStagingUploadCleanup(f.drive, drive => drive.uploadImage({})), /identity requires reconciliation/);
  assert.equal(f.calls.filter(c => c[0] === 'delete').length, 0);
});
test('Sheets keeps its exact original drive and partial-write failure behavior', async () => {
  const f = fixture('google-sheets');
  await assert.rejects(f.withStagingUploadCleanup(f.drive, async drive => { assert.equal(drive, f.drive); await drive.uploadImage({}); throw f.marker; }), error => error === f.marker);
  assert.equal(f.calls.includes('mutation-guard'), false); assert.equal(f.calls.filter(c => c[0] === 'delete').length, 0);
});
