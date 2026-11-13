/* eslint-disable @typescript-eslint/no-require-imports -- Explicit acceptance inventory, strict telemetry and generated-checkpoint recovery contracts. */
const assert = require('node:assert/strict');
const { requireGate } = require('./policy.cjs');
const { assessProfile } = require('./feasibility.cjs');
const BASE = 'WT00 WT01 WT02 WT03 WT09 WT07 WT08 WT04 WT05 WT06 WT10 WT11 WT12 WT13 WT14 WT15'.split(' ');
const EXTRA = 'WT_RAW_IMAGE WT_UNSUPPORTED_CONTRACTS WT_LINE_COMPLETE_JOURNEYS WT_HISTORICAL_CONTRACTS WT_LEGACY_ADVANCES WT_METHOD_FACTORY_SMOKE WT_ALL_METHOD_REPETITIONS WT_COMPOUND_ROLLBACK_REPETITIONS WT_CRASH_MATRIX WT_BROWSER_MATRIX WT_BROWSER_RAW_BYTES WT_LINE_COUNTER_PROBE WT_SALES_EDGES WT_HR_DATE_EDGES WT_UPLOAD_MULTIPLE_AND_CLEANUP_FAILURE WT_EXPENSE_REFERENCE_EDGES WT_MOVEMENT_INVALID_QUANTITIES WT_LINE_SESSION_EDGES WT_ALL_METHOD_BODY_INTENTS WT_SHIPMENT_TRANSITION_MATRIX WT_STOCK_REFERENCE_MATRIX WT_UPLOAD_BOUNDARIES WT_UPLOAD_SQL_ROLLBACK WT_UPLOAD_FINALIZE_ROLLBACK WT_UPLOAD_UNKNOWN_RETRY WT_UPLOAD_UNCERTAINTY_REPETITIONS WT_LINE_UPLOAD_ROLLBACKS WT_SHIPPING_UPLOAD_ROLLBACKS WT_FINAL_OUTCOMES'.split(' ');
const CASES = Object.freeze([...BASE, ...EXTRA]);
function strictObservation(profile, observation, identity, now = Date.now()) {
  const assessment = assessProfile(profile, now); requireGate(!assessment.blockers.length, 'STRICT_PROFILE_BLOCKED');
  requireGate(observation.projectRef === identity.projectRef && observation.isolationId === identity.isolationId && observation.protocol === 'original-1s-10s-cpu', 'OBSERVATION_IDENTITY');
  requireGate(Number.isFinite(observation.atMs) && now >= observation.atMs && now - observation.atMs <= 2000 && observation.allInstancesVerified === true, 'OBSERVATION_FRESHNESS');
  for (const [key, limit] of Object.entries(profile.limits)) requireGate(Number.isFinite(observation[key]) && observation[key] >= 0 && observation[key] <= .8 * limit, 'OBSERVATION_' + key.toUpperCase());
  requireGate(Number.isInteger(observation.runtimeBackends) && observation.runtimeBackends >= 0 && observation.runtimeBackends <= 4 && Number.isInteger(observation.totalBackends) && observation.totalBackends >= 0 && observation.totalBackends <= Math.floor(profile.connections.providerMaximum * .8) && profile.connections.providerMaximum - observation.totalBackends >= 5, 'OBSERVATION_CONNECTIONS');
  requireGate(Array.isArray(observation.cpuSamples) && observation.cpuSamples.length >= 11, 'OBSERVATION_CPU_WINDOW');
  const samples = observation.cpuSamples.slice(-11);
  requireGate(samples.every((sample, index) => Number.isFinite(sample.fraction) && sample.fraction >= 0 && sample.fraction <= 1 && Number.isFinite(sample.atMs) && (!index || sample.atMs - samples[index - 1].atMs >= 900 && sample.atMs - samples[index - 1].atMs <= 1100)), 'OBSERVATION_CPU_GAPS');
  requireGate(now - samples.at(-1).atMs <= 2000 && now >= samples.at(-1).atMs && samples.at(-1).atMs - samples[0].atMs >= 10000 && !samples.every(s => s.fraction > .8), 'OBSERVATION_CPU_HEADROOM');
  requireGate(observation.ooms === 0 && observation.unplannedRestarts === 0, 'OBSERVATION_RESTART'); return true;
}
function forecastTraffic({ components, complete, safetyFactor = 2, capBytes = 1000000000, remainingOrganizationBytes, protectedSourceReserveBytes = 2000000000 }) {
  requireGate(Array.isArray(components) && components.length >= 6 && safetyFactor >= 2 && Number.isFinite(safetyFactor) && complete === true, 'FORECAST_INCOMPLETE');
  for (const phase of ['functional', 'browser', 'load', 'database-wire', 'backup-recovery', 'coordinator-monitoring']) requireGate(components.some(c => c.phase === phase), 'FORECAST_MISSING_' + phase.toUpperCase());
  let bytes = 0;
  for (const component of components) { requireGate(Number.isSafeInteger(component.count) && component.count > 0 && Number.isSafeInteger(component.upperBytesEach) && component.upperBytesEach > 0 && component.pilotMeasured === true, 'FORECAST_UNMEASURED'); bytes += component.count * component.upperBytesEach; }
  const forecastBytes = Math.ceil(bytes * safetyFactor * 1.25);
  requireGate(Number.isSafeInteger(forecastBytes) && capBytes <= 1000000000 && forecastBytes <= capBytes && protectedSourceReserveBytes >= 2000000000 && Number.isSafeInteger(remainingOrganizationBytes) && remainingOrganizationBytes >= forecastBytes + protectedSourceReserveBytes, 'FORECAST_QUOTA');
  return { forecastBytes, reserveBytes: protectedSourceReserveBytes, scope: 'CONSERVATIVE_ALL_CHANNELS_NOT_PROVIDER_INVOICE', hostedRunAuthorized: false };
}
async function checkpointRecovery({ sourceRef, targetRef, clock = () => performance.now(), retrieveAndDecrypt, provision, restore, fingerprint, readOnlyApp, denyRuntimeWrite, evidence }) {
  requireGate(sourceRef && targetRef && sourceRef !== targetRef && ![sourceRef, targetRef].includes('orjnazrothkdgmzlsuto'), 'RECOVERY_NEW_TARGET');
  const began = clock(), checkpoint = await retrieveAndDecrypt();
  const deadline = () => requireGate(clock() >= began && clock() - began <= 900000, 'RECOVERY_RTO'); deadline();
  requireGate(checkpoint.independentlyDownloaded && checkpoint.decryptionVerified && checkpoint.checksumsVerified && checkpoint.dumpReadable && checkpoint.acknowledgedCommandsSealed, 'RECOVERY_ARTIFACT');
  await provision(); deadline(); await restore(checkpoint); deadline();
  const before = await fingerprint(); deadline();
  requireGate(before.tables === 51 && before.metadataSections === 15 && before.matchesCheckpoint === true, 'RECOVERY_FINGERPRINT');
  const denied = await denyRuntimeWrite(); requireGate(denied?.writeDenied === true && denied?.writerRoleMembershipDenied === true, 'RECOVERY_WRITE_DENIAL');
  deadline(); const ready = await readOnlyApp(); deadline(); const after = await fingerprint(); deadline();
  assert.deepEqual(after, before); requireGate(ready.ready && ready.providerCalls === 0 && ready.businessWrites === 0, 'RECOVERY_READ_ONLY');
  const seconds = (clock() - began) / 1000; requireGate(Number.isFinite(seconds) && seconds >= 0 && seconds <= 900, 'RECOVERY_RTO');
  const result = { status: 'PASS', seconds, tables: 51, metadataSections: 15, acknowledgedCheckpointCommandsLost: 0, scope: 'SEALED_CHECKPOINT_ONLY', timerIncludesRetrievalProvisionRestoreAndReadiness: true };
  await evidence(result); return result;
}
module.exports = { CASES, strictObservation, forecastTraffic, checkpointRecovery };
