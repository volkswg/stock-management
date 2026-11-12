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
  // The real PostgreSQL boundary preserves typed storage failures and sanitizes
  // other exceptions. A rollback signal carrying response counters must survive
  // that boundary instead of being converted to an unrelated generic failure.
  const execute = async (_kind, key, _intent, run) => { if (commands.has(key)) return commands.get(key); try { const result = await run(); commands.set(key, result); return result; } catch(error) { if(error instanceof PersistenceFailure)throw error;throw new PersistenceFailure(503); } };
  const source = ts.transpileModule(readFileSync('src/modules/line-workflows/infrastructure/postgres/webhook.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(source).runInNewContext({ exports, Object, Error, require(spec) {
    if (spec === 'server-only') return {};
    if (spec.endsWith('/commands')) return { executeCommand: execute, hashIntent: () => 'WT intent' };
    if (spec.endsWith('/uploads')) return { executeUploadCommand: execute, observeUpload: upload => upload() };
    if (spec.endsWith('/effects')) return { attemptEffectOnce: async (_key, send) => { await send(); } };
    if (spec.endsWith('/database')) return { PersistenceFailure, requireMutation: () => ({ query: async () => ({}) }) };
    assert.equal(spec, '../../application/webhook'); return { processWebhookEvents: async input => { executions++; const image=input.events[0].message.type==='image'; if (fail) input.runtime.error('WT SQL failed'); return { movementFailed: false, imageUploads: [], imageCounts: () => ({ scope:'movement',received:image?1:0,routedToMovement:0,otherFlows:0,unprocessed:0,failedBeforeRouting:fail&&image?1:0,uploaded:0,saved:0,alreadySaved:0,completed:0,failed:0,ignored:0,saveUncertain:0 }) }; } };
  } });
  const input = { events: [{ webhookEventId: 'WT_event', message: { type: 'text' } }], runtime: { error() {} }, lineBotService: { sendReply: async value => replies.push(value) } };
  assert.equal((await exports.processPostgresWebhook(input)).movementFailed, true);
  assert.equal(commands.size, 0); assert.equal(replies.length, 0);
  fail = false; await exports.processPostgresWebhook(input); await exports.processPostgresWebhook(input);
  assert.equal(commands.size, 1); assert.equal(executions, 2);
  fail=true;
  const failedBatch=await exports.processPostgresWebhook({...input,events:[1,2].map(n=>({webhookEventId:'WT_failed_image_'+n,message:{type:'image'}}))});
  assert.equal(failedBatch.movementFailed,true);assert.equal(failedBatch.imageCounts().received,2);assert.equal(failedBatch.imageCounts().unprocessed,1);assert.equal(failedBatch.imageCounts().failedBeforeRouting,1);
  assert.equal(commands.size,1);assert.equal(executions,3);assert.equal(replies.length,0);
});
