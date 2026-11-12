/* eslint-disable @typescript-eslint/no-require-imports -- Operator-only hosted acceptance gates; never an application import. */
const crypto = require('node:crypto');
const PROTECTED = Object.freeze({
  refs: ['orjnazrothkdgmzlsuto'],
  ids: ['160669bd-2f6f-4490-9259-bada5a1d02c4'],
  apps: ['prj_XH4nEje5cicuBuucGumuHgr73l1E'],
  hosts: ['inventra-beta-one.vercel.app'],
});
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function requireGate(condition, code) {
  if (!condition) { const error = new Error('Hosted acceptance gate: ' + code); error.code = code; throw error; }
}
function origin(value) {
  let url;
  try { url = new URL(value); } catch { requireGate(false, 'INVALID_ORIGIN'); }
  requireGate(url.protocol === 'https:' && !url.username && !url.password && !url.port && url.pathname === '/' && !url.search && !url.hash, 'INVALID_ORIGIN');
  return url.origin;
}
function inspectBinding(plan, binding) {
  requireGate(plan.version === 1 && binding.version === 1, 'VERSION');
  const forbidden = plan.protectedTargets || {};
  requireGate(/^[a-z]{20}$/.test(binding.projectRef || '') && ![...PROTECTED.refs, ...(forbidden.forbiddenSupabaseProjectRefs || [])].includes(binding.projectRef), 'PROTECTED_DATABASE');
  requireGate(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(binding.isolationId || '') && ![...PROTECTED.ids, ...(forbidden.forbiddenIsolationIds || [])].map(value => value.toLowerCase()).includes(binding.isolationId.toLowerCase()), 'PROTECTED_ISOLATION');
  requireGate(/^prj_[A-Za-z0-9]+$/.test(binding.appProjectId || '') && ![...PROTECTED.apps, ...(forbidden.forbiddenVercelProjectIds || [])].includes(binding.appProjectId), 'PROTECTED_APP');
  requireGate(/^dpl_[A-Za-z0-9]+$/.test(binding.deploymentId || ''), 'DEPLOYMENT_ID');
  const appOrigin = origin(binding.appOrigin);
  requireGate(new URL(appOrigin).hostname.endsWith('.vercel.app') && !PROTECTED.hosts.includes(new URL(appOrigin).hostname) && binding.environment === 'preview' && binding.productionDomains === false, 'PREVIEW_ONLY');
  requireGate(binding.region === 'ap-northeast-1' && binding.postgresMajor === 17 && ['F', 'RF', 'L1', 'RL1', 'L5', 'RL5'].includes(binding.stage), 'TARGET_PROFILE');
  requireGate(/^stock_ha_[a-z0-9_]+$/.test(binding.runtimeUser || ''), 'RUNTIME_LOGIN');
  requireGate(binding.database === 'postgres' && binding.providerMode === 'fake-only', 'FAKE_ONLY');
  requireGate(['direct', 'session'].includes(binding.connectionMode), 'CONNECTION_MODE');
  const directHost = 'db.' + binding.projectRef + '.supabase.co';
  requireGate(binding.databaseHost === directHost || (binding.connectionMode === 'session' && /^aws-[0-9]+-ap-northeast-1\.pooler\.supabase\.com$/.test(binding.databaseHost || '')), 'DATABASE_HOST');
  requireGate(binding.databasePort === 5432 && (binding.connectionMode !== 'direct' || binding.databaseHost === directHost), 'DATABASE_PORT');
  for (const name of ['sourceCommit', 'adapterSha256', 'fixtureSha256', 'baselineSha256']) requireGate(new RegExp('^[a-f0-9]{' + (name === 'sourceCommit' ? 40 : 64) + '}$').test(binding[name] || ''), 'UNSEALED_' + name.toUpperCase());
  return Object.freeze({ appOrigin, projectRef: binding.projectRef, isolationId: binding.isolationId, stage: binding.stage });
}
function assertExecution(plan, binding, approval, env, now = Date.now()) {
  const inspected = inspectBinding(plan, binding);
  requireGate(plan.authorization?.executionEnabled === true && plan.authorization?.resourceCreationApproved === true && plan.authorization?.hostedWritesApproved === true, 'EXECUTION_DISABLED');
  requireGate(plan.applicationProposal?.harnessStatus === 'REVIEWED_HOSTED_RUNTIME_AND_CAMPAIGN', 'RUNTIME_NOT_REVIEWED');
  requireGate(approval?.bindingSha256 === sha(JSON.stringify(binding)) && approval?.sourceCommit === binding.sourceCommit && approval?.stage === binding.stage && approval?.hostedWritesApproved === true && approval?.paidResourcesApproved === false && approval?.productionCutoverApproved === false, 'APPROVAL_BINDING');
  requireGate(Number.isFinite(now) && Number.isFinite(approval?.expiresAtMs) && approval.expiresAtMs > now && approval.expiresAtMs - now <= 86400000, 'APPROVAL_EXPIRED');
  requireGate(env.VERCEL_ENV === 'preview' && env.VERCEL_PROJECT_ID === binding.appProjectId && env.VERCEL_DEPLOYMENT_ID === binding.deploymentId && env.STOCK_STORAGE === 'supabase' && env.STOCK_STAGING_ENABLED === 'true' && env.STOCK_TARGET_ISOLATION_ID === binding.isolationId, 'ENVIRONMENT_IDENTITY');
  requireGate(!env.STOCK_LOCAL_WRITE_HARNESS && !env.STOCK_ALLOW_LOCAL_TEST_DATABASE && env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'LOCAL_OR_TLS_OVERRIDE');
  for (const key of Object.keys(env)) if (/^(GOOGLE_|LOYVERSE_|LINE_CHANNEL_|NEXT_PUBLIC_.*(TOKEN|SECRET|DATABASE))/.test(key) && env[key]) requireGate(false, 'REAL_PROVIDER_CREDENTIAL');
  let database;
  try { database = new URL(env.STOCK_DATABASE_URL); } catch { requireGate(false, 'DATABASE_URL'); }
  const user = binding.connectionMode === 'session' ? binding.runtimeUser + '.' + binding.projectRef : binding.runtimeUser;
  requireGate(['postgres:', 'postgresql:'].includes(database.protocol) && database.hostname === binding.databaseHost && Number(database.port || 5432) === 5432 && database.pathname === '/postgres' && decodeURIComponent(database.username) === user && database.password && !database.search && !database.hash, 'DATABASE_IDENTITY');
  requireGate(typeof env.STOCK_STAGING_AUTH_TOKEN === 'string' && env.STOCK_STAGING_AUTH_TOKEN.length >= 32, 'API_TOKEN');
  return inspected;
}
module.exports = { sha, requireGate, origin, inspectBinding, assertExecution };
