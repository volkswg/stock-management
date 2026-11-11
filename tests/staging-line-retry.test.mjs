import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
test('the staging LINE request boundary translates asynchronous storage failures to a safe 503 response', async () => {
  const exports = {};
  class PersistenceFailure extends Error { constructor(status = 503, message = 'WT safe retry') { super(message); this.status = status; } }
  const source = ts.transpileModule(readFileSync('src/composition/postgres/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(source).runInNewContext({ exports, Buffer, Request, Response, URL, Error, require(spec) {
    if (spec === 'server-only') return {};
    if (spec === 'node:crypto') return crypto;
    if (spec.endsWith('/commands')) return {};
    if (spec.endsWith('/uploads')) return {};
    assert.ok(spec.endsWith('/database')); return { PersistenceFailure, storageMode: () => 'supabase', stagingSettings: () => ({}), stagingReadOnly: () => false };
  } });
  const handler = exports.withPersistence(async () => { await Promise.resolve(); throw new PersistenceFailure(); }, { lineWebhook: true });
  const response = await handler(new Request('http://127.0.0.1/api/line/webhook', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'WT safe retry' });
});
test('failed staging LINE business work does not commit a completed command that suppresses retry', async () => {
  const exports = {}, commands = new Map(), replies = []; let fail = true, executions = 0;
  class PersistenceFailure extends Error { constructor(status) { super('WT retry required'); this.status = status; } }
  const execute = async (_kind, key, _intent, run) => { if (commands.has(key)) return commands.get(key); const result = await run(); commands.set(key, result); return result; };
  const source = ts.transpileModule(readFileSync('src/modules/line-workflows/infrastructure/postgres/webhook.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(source).runInNewContext({ exports, Object, Error, require(spec) {
    if (spec === 'server-only') return {};
    if (spec.endsWith('/commands')) return { executeCommand: execute, hashIntent: () => 'WT intent' };
    if (spec.endsWith('/uploads')) return { executeUploadCommand: execute, observeUpload: upload => upload() };
    if (spec.endsWith('/effects')) return { attemptEffectOnce: async (_key, send) => { await send(); } };
    if (spec.endsWith('/database')) return { PersistenceFailure, requireMutation: () => ({ query: async () => ({}) }) };
    assert.equal(spec, '../../application/webhook'); return { processWebhookEvents: async input => { executions++; if (fail) input.runtime.error('WT SQL failed'); return { movementFailed: false, imageUploads: [], imageCounts: () => ({ received: 0 }) }; } };
  } });
  const input = { events: [{ webhookEventId: 'WT_event', message: { type: 'text' } }], runtime: { error() {} }, lineBotService: { sendReply: async value => replies.push(value) } };
  await assert.rejects(exports.processPostgresWebhook(input), e => e.status === 503);
  assert.equal(commands.size, 0); assert.equal(replies.length, 0);
  fail = false; await exports.processPostgresWebhook(input); await exports.processPostgresWebhook(input);
  assert.equal(commands.size, 1); assert.equal(executions, 2);
});
