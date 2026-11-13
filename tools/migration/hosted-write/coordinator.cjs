/* eslint-disable @typescript-eslint/no-require-imports -- Durable fake-provider journal; opening storage does not start a listener. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { sha, requireGate } = require('./policy.cjs');
const { classifyUploads } = require('./provider-outcomes.cjs');
const MAXIMUM_BLOB = 20 * 1024 * 1024;
function privateStat(file, directory) {
  const stat = fs.lstatSync(file);
  requireGate(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()) && (stat.mode & 0o777) === (directory ? 0o700 : 0o600) && (directory || stat.nlink === 1), 'PRIVATE_FILE');
}
function syncDirectory(directory) {
  const fd = fs.openSync(directory, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function openCoordinator(directory, { runId, targetId, catalog = {}, pageResolver, evidenceScope = 'OFFLINE_SYNTHETIC_ONLY' }) {
  catalog = structuredClone(catalog);
  requireGate(/^WT_[A-Za-z0-9_-]+$/.test(runId || '') && /^WT_[A-Za-z0-9_-]+$/.test(targetId || ''), 'OFFLINE_NAMESPACE');
  directory = path.resolve(directory);
  requireGate(fs.realpathSync(path.dirname(directory)) === path.dirname(directory), 'SYMLINK_PARENT');
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
  privateStat(directory, true);
  const lock = path.join(directory, 'writer.lock'), journalPath = path.join(directory, 'journal.jsonl');
  const lockFd = fs.openSync(lock, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  let fd, closed = false, poisoned = false, previous = '0'.repeat(64), sequence = 0;
  const events = [], requests = new Map(), files = new Map(), attempts = new Map(), consumed = new Map(), leases = new Map(), previews = new Map();
  let controls = {};
  let ingressOpen = false;
  const identity = { kind: 'coordinator-identity', runId, targetId, catalogSha256: sha(JSON.stringify(catalog)), model: 'DURABLE_FAKE_COORDINATOR_V2', evidenceScope };
  function apply(event) {
    events.push(event);
    if (event.kind === 'control-set') controls = event.value;
    if (event.kind === 'ingress') ingressOpen = event.open;
    if (event.kind === 'transaction-lease') leases.set(event.leaseId, event);
    if (event.kind === 'transaction-release') leases.delete(event.leaseId);
    if (event.kind === 'preview-registered') previews.set(event.manifest.binding.deploymentId, event.manifest);
    if (event.kind === 'control-consumed') { controls[event.name] = event.value; consumed.set(event.requestId, event.result); }
    if (event.kind === 'fake-provider') attempts.set(event.attemptId, event);
    if (event.kind === 'request-begin') {
      requireGate(!requests.has(event.requestId), 'DUPLICATE_REQUEST');
      requests.set(event.requestId, { digest: event.digest, response: null });
    }
    if (event.kind === 'request-finish') {
      const request = requests.get(event.requestId);
      requireGate(request && !request.response, 'INVALID_REQUEST_RESULT'); request.response = event.response;
    }
    if (event.kind === 'fake-provider-outcome' && event.phase === 'accepted') {
      const attempt = attempts.get(event.attemptId);
      requireGate(attempt, 'MISSING_ATTEMPT');
      if (attempt.provider === 'drive' && attempt.operation === 'upload') files.set(attempt.id, { exists: true, bytes: attempt.bytes, contentSha256: attempt.contentSha256, contentType: attempt.contentType });
      if (attempt.provider === 'drive' && attempt.operation === 'delete') { requireGate(files.has(attempt.id), 'MISSING_FILE'); files.get(attempt.id).exists = false; }
    }
  }
  function append(event) {
    requireGate(!closed && !poisoned, 'COORDINATOR_CLOSED');
    const record = { sequence: sequence + 1, previous, event }, hash = sha(JSON.stringify(record));
    try { fs.writeFileSync(fd, JSON.stringify({ ...record, hash }) + '\n'); fs.fsyncSync(fd); }
    catch { poisoned = true; requireGate(false, 'JOURNAL_WRITE_UNCERTAIN'); }
    sequence++; previous = hash; apply(event);
  }
  try {
    if (fs.existsSync(journalPath)) {
      privateStat(journalPath, false);
      const raw = fs.readFileSync(journalPath, 'utf8');
      requireGate(raw.endsWith('\n'), 'TRUNCATED_JOURNAL');
      for (const line of raw.trimEnd().split('\n')) {
        const { sequence: seq, previous: prev, event, hash } = JSON.parse(line);
        requireGate(seq === sequence + 1 && prev === previous && sha(JSON.stringify({ sequence: seq, previous: prev, event })) === hash, 'JOURNAL_INTEGRITY');
        sequence = seq; previous = hash; apply(event);
      }
      requireGate(JSON.stringify(events[0]) === JSON.stringify(identity), 'COORDINATOR_IDENTITY');
      fd = fs.openSync(journalPath, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
    } else {
      fd = fs.openSync(journalPath, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      append(identity); syncDirectory(directory);
    }
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    fs.closeSync(lockFd); fs.unlinkSync(lock); throw error;
  }
  function storeBlob(id, bytes) {
    const file = path.join(directory, id);
    const blobFd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try { fs.writeFileSync(blobFd, bytes); fs.fsyncSync(blobFd); } finally { fs.closeSync(blobFd); }
    syncDirectory(directory);
  }
  function validate(request) {
    requireGate(request && /^WT_[A-Za-z0-9_-]{1,180}$/.test(request.requestId || ''), 'REQUEST_ID');
    requireGate(['complete', 'reject', 'uncertain', 'accepted-only'].includes(request.mode || 'complete'), 'FAULT_MODE');
    requireGate(['drive-upload', 'drive-delete', 'drive-share', 'line-reply', 'line-push', 'line-download', 'loyverse-page'].includes(request.operation), 'FAKE_OPERATION');
    if (request.operation === 'drive-upload') {
      requireGate(Buffer.isBuffer(request.bytes) && request.bytes.length > 0 && request.bytes.length <= MAXIMUM_BLOB && ['image/png', 'image/jpeg', 'application/pdf'].includes(request.contentType), 'UPLOAD_FIXTURE');
    } else if (request.operation.startsWith('drive-')) requireGate(/^WT_FILE_[a-f0-9-]{36}$/.test(request.fileId || '') && files.has(request.fileId), 'ORIGINAL_FILE_DENIED');
    else if (request.operation.startsWith('line-')) requireGate(/^WT_[A-Za-z0-9_-]+$/.test(request.recipient || '') && Number.isInteger(request.messageCount) && request.messageCount > 0 && request.messageCount <= 5, 'ORIGINAL_LINE_DENIED');
    else requireGate(['A', 'B'].includes(request.account) && (typeof pageResolver === 'function' || Object.hasOwn(catalog, request.catalogKey) && catalog[request.catalogKey].account === request.account), 'UNSEALED_SALES_FIXTURE');
  }
  return Object.freeze({
    perform(request) {
      requireGate(!closed && !poisoned, 'COORDINATOR_CLOSED'); validate(request);
      const digest = sha(JSON.stringify({ ...request, bytes: request.bytes ? { sha256: sha(request.bytes), length: request.bytes.length } : undefined }));
      const prior = requests.get(request.requestId);
      if (prior) {
        requireGate(prior.digest === digest, 'COORDINATOR_INTENT_CONFLICT');
        return structuredClone(prior.response || { outcome: 'unknown', replayed: false, requiresReview: true });
      }
      append({ kind: 'request-begin', requestId: request.requestId, digest });
      const [provider, operation] = request.operation.split('-'), attemptId = crypto.randomUUID(), id = operation === 'upload' ? 'WT_FILE_' + crypto.randomUUID() : request.fileId;
      const event = { kind: 'fake-provider', provider, operation: provider === 'loyverse' ? 'receipt-page' : operation, attemptId };
      if (provider === 'drive') Object.assign(event, { id });
      if (operation === 'upload') Object.assign(event, { bytes: request.bytes.length, contentType: request.contentType, contentSha256: sha(request.bytes) });
      if (provider === 'line') Object.assign(event, { recipientHash: sha(request.recipient), messageCount: request.messageCount });
      append(event);
      const phase = value => append({ kind: 'fake-provider-outcome', attemptId, phase: value });
      const reply = provider === 'loyverse' ? structuredClone(pageResolver ? pageResolver(request, structuredClone(controls)) : catalog[request.catalogKey].reply) : undefined;
      let response;
      if (request.mode === 'reject' || reply?.status >= 400) { phase('rejected'); response = { outcome: 'rejected', ...(reply ? { reply } : {}) }; }
      else {
        if (operation === 'upload') storeBlob(id, request.bytes);
        phase('accepted');
        if (request.mode === 'accepted-only') return { outcome: 'unknown', requiresReview: true };
        if (request.mode === 'uncertain') { phase('uncertain'); response = { outcome: 'unknown', requiresReview: true }; }
        else { phase('completed'); response = { outcome: 'completed', ...(id ? { fileId: id } : {}), ...(reply ? { reply } : {}) }; }
      }
      append({ kind: 'request-finish', requestId: request.requestId, response });
      return structuredClone(response);
    },
    control(value) { requireGate(value && typeof value === 'object' && !Array.isArray(value), 'CONTROL_OBJECT'); append({ kind: 'control-set', value: structuredClone(value) }); },
    ingress(open) { requireGate(typeof open === 'boolean', 'INGRESS_VALUE'); append({ kind: 'ingress', open }); },
    permitted() { return ingressOpen; },
    lease(backendPid, instanceId) {
      requireGate(Number.isInteger(backendPid) && backendPid > 0 && typeof instanceId === 'string' && instanceId.length <= 80, 'LEASE_IDENTITY');
      if (!ingressOpen) return { permitted: false };
      const leaseId = crypto.randomUUID(); append({ kind: 'transaction-lease', leaseId, backendPid, instanceId }); return { permitted: true, leaseId };
    },
    release(leaseId, instanceId, reconciled = false) {
      const lease = leases.get(leaseId); requireGate(lease && lease.instanceId === instanceId, 'LEASE_RELEASE'); append({ kind: 'transaction-release', leaseId, reconciled });
    },
    leases() { return structuredClone([...leases.values()]); },
    registerPreview(manifest) { append({ kind: 'preview-registered', manifest: structuredClone(manifest) }); },
    preview(deploymentId) { return structuredClone(previews.get(deploymentId)); },
    controls() { return structuredClone(controls); },
    consume(name, requestId, matches) {
      if (consumed.has(requestId)) return structuredClone(consumed.get(requestId));
      const value = controls[name];
      if (!value || (value.remaining ?? 1) <= 0 || !matches(value)) return false;
      const result = structuredClone(value), next = { ...value, remaining: (value.remaining ?? 1) - 1 };
      append({ kind: 'control-consumed', requestId, name, value: next, result }); return result;
    },
    record(event) { append(structuredClone(event)); },
    events(cursor = 0, limit = events.length) { return structuredClone(events.slice(cursor, cursor + limit)); },
    eventCount() { return events.length; },
    readFile(id) {
      requireGate(!closed && files.get(id)?.exists, 'FAKE_FILE_NOT_FOUND');
      const file = path.join(directory, id); privateStat(file, false);
      const bytes = fs.readFileSync(file), info = files.get(id);
      requireGate(bytes.length === info.bytes && sha(bytes) === info.contentSha256, 'FAKE_FILE_INTEGRITY');
      return { bytes, contentType: info.contentType };
    },
    evidence(referencedIds = [], historyIds = []) {
      requireGate(!closed, 'COORDINATOR_CLOSED');
      const uploads = classifyUploads(events, referencedIds, historyIds);
      const unjournaledBlobIds = fs.readdirSync(directory).filter(name => name.startsWith('WT_FILE_') && !files.has(name));
      const corruptBlobIds = [];
      for (const [id, info] of files) {
        try {
          const file = path.join(directory, id); privateStat(file, false);
          const bytes = fs.readFileSync(file);
          if (bytes.length !== info.bytes || sha(bytes) !== info.contentSha256) corruptBlobIds.push(id);
        } catch { corruptBlobIds.push(id); }
      }
      if (unjournaledBlobIds.length || corruptBlobIds.length) uploads.pass = false;
      return { proof: evidenceScope, sequence, journalSha256: sha(fs.readFileSync(journalPath)), chainHead: previous, pendingRequests: [...requests.values()].filter(value => !value.response).length, unjournaledBlobIds, corruptBlobIds, uploads };
    },
    close() { if (!closed) { closed = true; fs.closeSync(fd); fs.closeSync(lockFd); fs.unlinkSync(lock); syncDirectory(directory); } },
  });
}
module.exports = { openCoordinator };
