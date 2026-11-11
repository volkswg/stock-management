import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
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
