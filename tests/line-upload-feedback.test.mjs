import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function current(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new vm.Script(code).runInNewContext({ exports, Error, Object, Map, Date, require(name) { assert.ok(Object.hasOwn(imports, name), name); return imports[name]; } });
  return exports;
}
test('movement upload diagnostics identify the safe stage/status/reason without disclosing provider body or credentials', async () => {
  const logs = [], replies = [];
  let appends = 0;
  const app = current('src/modules/line-workflows/application/movement-events.ts', {
    '@/shared/types/line-protocol': { LineMessageType: { Image: 'image' } },
    '@/modules/orders/rules': {}, '@/modules/inventory/quantity': {}, '../contracts': {},
    './classify-event': { isMovementStartCommand: () => false }, './sessions': {},
    './reply': { replyText: async (_line, _event, text) => replies.push(text) },
  });
  await app.handleMovementEvent({ event: { webhookEventId: 'WT_event', source: { userId: 'WT_user' }, message: { type: 'image', id: 'WT_image' } },
    session: { processed: false, photoItems: [], state: { step: 'close_bag', shop: 'NJ', itemId: 'WT_item', masterId: 'WT_master' } },
    context: { inventory: { append() { appends++; } } }, createMode: 'photo_only',
    drive: () => ({ uploadImage() { throw Error('Google OAuth refresh failed: 400 invalid_grant secret=DO_NOT_LOG https://private.example/token'); } }),
    line: { downloadMessageContent: async () => ({ contentType: 'image/png', bytes: 'WT_bytes' }) },
    imageUpload: {}, runtime: { error: (label, details) => logs.push({ label, ...details() }) },
  });
  assert.equal(appends, 0); assert.equal(replies.length, 1);
  assert.equal(logs[0].stage, 'drive_upload'); assert.equal(logs[0].providerStatus, 400); assert.equal(logs[0].providerReason, 'invalid_grant');
  assert.doesNotMatch(JSON.stringify(logs), /DO_NOT_LOG|private.example|WT_bytes/);
});

function fixture() {
  const commands = new Map(), effects = new Map(), sent = [];
  let phase = 'rollback', executions = 0, inTransaction = false;
  class PersistenceFailure extends Error { constructor(status = 503) { super('WT storage unavailable'); this.status = status; } }
  const execute = async (_kind, key, _intent, run) => {
    if (phase === 'uncertain') throw new PersistenceFailure();
    if (commands.has(key)) return commands.get(key);
    inTransaction = true;
    try { const value = await run(); commands.set(key, value); return value; }
    finally { inTransaction = false; }
  };
  const app = current('src/modules/line-workflows/infrastructure/postgres/webhook.ts', {
    'server-only': {},
    '@/infrastructure/persistence/postgres/commands': { executeCommand: execute, hashIntent: () => 'WT_intent' },
    '@/infrastructure/persistence/postgres/uploads': { executeUploadCommand: execute, observeUpload: upload => upload() },
    '@/infrastructure/persistence/postgres/database': { PersistenceFailure, requireMutation: () => ({ query: async () => ({}) }) },
    '@/infrastructure/persistence/postgres/effects': { attemptEffectOnce: async (key, send) => {
      assert.equal(inTransaction, false, 'Reply sent inside the rolled-back transaction');
      if (effects.has(key)) return false;
      effects.set(key, 'sending');
      try { await send(); effects.set(key, 'done'); return true; } catch { effects.set(key, 'uncertain'); return false; }
    } },
    '../../application/webhook': { processWebhookEvents: async input => {
      executions++;
      await input.lineBotService.sendReply('WT_token', [{ type: 'text', text: 'WT success must not escape a rollback' }]);
      return { movementFailed: phase === 'rollback', imageUploads: [{ failed: phase === 'rollback' }], imageCounts: () => ({ scope: 'movement', received: 1, failed: phase === 'rollback' ? 1 : 0 }) };
    } },
  });
  const input = { events: [{ webhookEventId: 'WT_event', replyToken: 'WT_token', message: { type: 'image' } }],
    runtime: { error() {} }, lineBotService: { sendReply: async (token, messages) => sent.push({ token, messages }) } };
  return { app, input, commands, effects, sent, executions: () => executions, phase(value) { phase = value; } };
}
test('rollback sends one safe failure notice outside the transaction, never a queued success or completed business command', async () => {
  const f = fixture(); const result = await f.app.processPostgresWebhook(f.input);
  assert.equal(result.movementFailed, true); assert.equal(f.commands.size, 0);
  assert.equal(f.sent.length, 1); assert.match(f.sent[0].messages[0].text, /before resending/);
  assert.doesNotMatch(f.sent[0].messages[0].text, /WT success/);
  await f.app.processPostgresWebhook(f.input);
  assert.equal(f.sent.length, 1); assert.equal(f.effects.get('LINE:WT_event:failure-reply'), 'done');
});
test('uncertain upload retries remain blocked but receive at most one failure notice', async () => {
  const f = fixture(); f.phase('uncertain');
  await assert.rejects(f.app.processPostgresWebhook(f.input), e => e.status === 503);
  await assert.rejects(f.app.processPostgresWebhook(f.input), e => e.status === 503);
  assert.equal(f.executions(), 0); assert.equal(f.commands.size, 0); assert.equal(f.sent.length, 1);
});
test('failure notice does not consume a recovered success reply; completed events never repeat business work or reply', async () => {
  const f = fixture(); await f.app.processPostgresWebhook(f.input); f.phase('success');
  await f.app.processPostgresWebhook(f.input); await f.app.processPostgresWebhook(f.input);
  assert.equal(f.executions(), 2); assert.equal(f.sent.length, 2); assert.equal(f.commands.size, 1);
  assert.ok(f.effects.has('LINE:WT_event:failure-reply')); assert.ok(f.effects.has('LINE:WT_event:reply:0'));
});
test('missing reply token never claims a failure effect or weakens rollback', async () => {
  const f = fixture(); delete f.input.events[0].replyToken;
  assert.equal((await f.app.processPostgresWebhook(f.input)).movementFailed, true);
  assert.equal(f.effects.size, 0); assert.equal(f.sent.length, 0); assert.equal(f.commands.size, 0);
});
