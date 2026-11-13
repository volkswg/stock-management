/* eslint-disable @typescript-eslint/no-require-imports -- Offline packet report. Does not open sockets, load secrets or provision resources. */
const plan = require('../hosted-acceptance-plan.json');
const { assessProfile, measurePayload } = require('./feasibility.cjs');
async function inspectPacket(packet = plan) {
  const payloads = [];
  for (const [name, bytes, type] of [['normal-fixture', 262144, 'image/png'], ['advertised-image-limit', 10 * 1024 * 1024, 'image/png'], ['advertised-shipping-file-limit', 20 * 1024 * 1024, 'application/pdf']]) {
    const body = new FormData(); body.set('file', new Blob([Buffer.alloc(bytes)], { type }), type === 'application/pdf' ? 'WT_fixture.pdf' : 'WT_fixture.png');
    payloads.push({ name, fileBytes: bytes, scope: 'SERIALIZATION_ONLY_NOT_MIME_OR_HOSTED_ACCEPTANCE', ...await measurePayload(body) });
  }
  return {
    version: 1, proof: 'OFFLINE_SYNTHETIC_ONLY', executionEnabled: packet.authorization.executionEnabled,
    cloudResourcesCreated: 0, hostedRequests: 0, existingDataReadsOrWrites: 0,
    adapter: 'PRIVATE_BUILD_RUNTIME_BROWSER_COORDINATOR_CASE_LOAD_ORACLE_RECOVERY_TOOLING',
    localTooling: 'IMPLEMENTED_FOR_REVIEW_HOSTED_EXECUTION_DISABLED',
    fullHostedHarness: 'HOSTED_ENVIRONMENT_ACCEPTANCE_NOT_RUN',
    proposals: require('./proposals.json'),
    strictResourceCapacity: assessProfile({ telemetry: { sampleIntervalMs: packet.acceptance?.capacity?.nativeMetricsGuidanceSeconds * 1000 } }),
    payloads, productionCutover: 'NO_GO',
  };
}
module.exports = { inspectPacket };
if (require.main === module) inspectPacket().then(result => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error('Offline packet inspection failed.'); process.exitCode = 1; });
