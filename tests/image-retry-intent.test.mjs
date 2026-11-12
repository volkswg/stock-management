import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import binaryFixtures from '../tools/migration/local-write/binary-fixtures.cjs';

// Actual wrapper + actual command/hash implementation, over a closed synthetic
// journal transport. HTTP/body semantics are native; no network or credentials.
function fixture(mode = 'supabase') {
  const rows = new Map();
  class PersistenceFailure extends Error { constructor(status = 503, message = 'Synthetic unavailable') { super(message); this.status = status; } }
  const db = {
    PersistenceFailure, storageMode: () => mode, stagingReadOnly: () => false,
    stagingSettings: () => ({ token: 'WT_synthetic_only' }),
    transaction: async (_mutation, run) => run(),
    currentTransaction: () => client, requireMutation: () => client,
  };
  const client = { async query(sql, values = []) {
    if (sql === 'SELECT value::text AS revision FROM stock_operational.revision WHERE singleton') return { rowCount: 1, rows: [{ revision: '7' }] };
    const key = JSON.stringify(values.slice(0, 3));
    if (sql.startsWith('SELECT intent,response,state FROM stock_operational.commands')) {
      const row = rows.get(key); return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
    }
    if (sql.startsWith('INSERT INTO stock_operational.commands')) { assert.ok(!rows.has(key)); rows.set(key, { intent: values[3], state: 'pending' }); return {}; }
    if (sql.startsWith('UPDATE stock_operational.commands SET state=')) { Object.assign(rows.get(key), { state: 'complete', response: JSON.parse(values[3]) }); return {}; }
    assert.fail('Unapproved synthetic SQL');
  } };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    assert.ok(['src/composition/postgres/route.ts', 'src/infrastructure/persistence/postgres/commands.ts'].includes(file));
    const exports = {}; cache.set(file, exports);
    const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new vm.Script(source, { filename: file }).runInNewContext({ exports, Buffer, Request, Response, URL, Error, require(spec) {
      if (spec === 'server-only') return {};
      if (spec === 'node:crypto') return crypto;
      if (spec === './database' || spec === '@/infrastructure/persistence/postgres/database') return db;
      if (spec === '@/infrastructure/persistence/postgres/uploads') return { executeUploadCommand: (...args) => load('src/infrastructure/persistence/postgres/commands.ts').executeCommand(...args) };
      if (spec === '@/infrastructure/persistence/postgres/commands') return load('src/infrastructure/persistence/postgres/commands.ts');
      assert.fail('Unapproved source import: ' + spec);
    } });
    return exports;
  }
  const { withPersistence } = load('src/composition/postgres/route.ts');
  let executions = 0;
  const handler = withPersistence(async request => {
    executions++;
    return Response.json({ sha256: crypto.createHash('sha256').update(Buffer.from(await request.arrayBuffer())).digest('hex'), executions });
  });
  const request = (key, body, type = 'image/png') => new Request('http://synthetic.invalid/api/image', { method: 'PATCH', headers: { authorization: 'Bearer WT_synthetic_only', 'Idempotency-Key': key, ...(type ? { 'content-type': type } : {}) }, body });
  return { handler, request, rows, commands: load('src/infrastructure/persistence/postgres/commands.ts'), get executions() { return executions; } };
}

test('raw image intent preserves bytes, exact retry response and a later intentional upload', async () => {
  const f = fixture(), [a, b] = binaryFixtures.collisionPngPair();
  const first = await f.handler(f.request('WT_image_key_01', a)), body = await first.text();
  assert.equal(first.status, 200);
  const replay = await f.handler(f.request('WT_image_key_01', a));
  assert.equal(await replay.text(), body); assert.equal(replay.headers.get('x-stock-revision'), first.headers.get('x-stock-revision'));
  assert.equal((await f.handler(f.request('WT_image_key_01', b))).status, 409);
  assert.equal(f.executions, 1);
  const fresh = await f.handler(f.request('WT_image_key_02', b));
  assert.equal(fresh.status, 200); assert.notEqual(await fresh.text(), body); assert.equal(f.executions, 2);
  assert.equal(await (await f.handler(f.request('WT_image_key_01', a))).text(), body);
});

test('raw image intent includes the media type consumed by the upload route', async () => {
  const f = fixture(), [a] = binaryFixtures.collisionPngPair();
  assert.equal((await f.handler(f.request('WT_media_key_01', a))).status, 200);
  assert.equal((await f.handler(f.request('WT_media_key_01', a, 'image/webp'))).status, 409);
  assert.equal((await f.handler(f.request('WT_media_key_01', a, 'image/png; charset=binary'))).status, 200);
  assert.equal(f.executions, 1);
});

test('JSON canonicalization and ordinary text intent remain compatible', async () => {
  const f = fixture();
  assert.equal((await f.handler(f.request('WT_json_key_01', '{"a":1,"b":2}', 'application/json'))).status, 200);
  assert.equal((await f.handler(f.request('WT_json_key_01', '{ "b": 2, "a": 1 }', 'application/json'))).status, 200);
  assert.equal((await f.handler(f.request('WT_json_key_01', '{"a":3,"b":2}', 'application/json'))).status, 409);
  assert.equal((await f.handler(f.request('WT_text_key_01', 'ordinary text', 'text/plain'))).status, 200);
  assert.equal((await f.handler(f.request('WT_text_key_01', 'ordinary text', 'text/plain'))).status, 200);
  assert.equal((await f.handler(f.request('WT_text_key_01', 'changed text', 'text/plain'))).status, 409);
  assert.equal(f.executions, 2);
});

test('multipart retries preserve field/file metadata and compare the actual file bytes', async () => {
  const f = fixture(), [a, b] = binaryFixtures.collisionPngPair();
  const form = (bytes, name = 'WT.png') => { const result = new FormData(); result.set('note', 'WT'); result.set('image', new Blob([bytes], { type: 'image/png' }), name); return result; };
  assert.equal((await f.handler(f.request('WT_form_key_01', form(a), null))).status, 200);
  assert.equal((await f.handler(f.request('WT_form_key_01', form(a), null))).status, 200);
  assert.equal((await f.handler(f.request('WT_form_key_01', form(b), null))).status, 409);
  assert.equal((await f.handler(f.request('WT_form_key_01', form(a, 'changed.png'), null))).status, 409);
  assert.equal(f.executions, 1);
});

test('old lossy raw-image command keys conflict safely without altering or reexecuting their journal', async () => {
  const f = fixture(), [a] = binaryFixtures.collisionPngPair(), { executeCommand, hashIntent } = f.commands;
  await executeCommand('PATCH:/api/image', 'WT_old_image_key', hashIntent({ query: '', body: hashIntent(a.toString('utf8')) }), async () => ({ status: 200, body: Buffer.from('old response').toString('base64'), headers: [] }));
  const before = JSON.stringify([...f.rows]);
  assert.equal((await f.handler(f.request('WT_old_image_key', a))).status, 409);
  assert.equal(f.executions, 0); assert.equal(JSON.stringify([...f.rows]), before);
});

test('Google Sheets bypass still consumes image bytes directly without staging keys', async () => {
  const f = fixture('google-sheets'), [a] = binaryFixtures.collisionPngPair();
  assert.equal((await f.handler(new Request('http://synthetic.invalid/api/image', { method: 'PATCH', body: a }))).status, 200);
  assert.equal(f.executions, 1); assert.equal(f.rows.size, 0);
});
