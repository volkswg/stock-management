/* eslint-disable @typescript-eslint/no-require-imports -- No provisioning/deployment commands. The checked-in packet always stops before loading secrets or opening a connection. */
const fs = require('node:fs');
const { requireGate, assertExecution } = require('./policy.cjs');
const { strictObservation, CASES } = require('./protocol.cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function runPacket(packet) {
  // Gate first, before constructing adapters, reading credential files or allocating evidence.
  const selected = packet.previews?.quantity_photo; requireGate(selected, 'PREVIEW_PACKET_REQUIRED');
  assertExecution(packet.plan, selected.manifest.binding, selected.manifest.approval, selected.env);
  require('./seals.cjs').verifySeals(selected.manifest.binding);
  requireGate(packet.previews.photo_only && typeof packet.profileFile === 'string', 'COMPLETE_PACKET_REQUIRED');
  require('../../../tests/helpers/postgres-runtime.cjs');
  const { createCampaign } = require('./campaign.cjs'), { configuration } = require('./runtime.cjs');
  const nativeFetch = globalThis.fetch;
  const profileGate = async () => { const current = JSON.parse(fs.readFileSync(packet.profileFile)); strictObservation(current.profile, current.observation, selected.manifest.binding); };
  let campaign;
  const lifecycle = { async restart(mode) {
    const next = packet.previews[mode]; configuration(next.env, next.manifest);
    for (let n = 0; n < 60; n++) {
      await profileGate();
      try {
        const response = await nativeFetch(next.manifest.appOrigin + '/api/ha-test', { headers: { authorization: 'Bearer ' + next.seedToken, 'x-vercel-protection-bypass': next.env.STOCK_HA_DEPLOYMENT_ACCESS_TOKEN || next.env.VERCEL_AUTOMATION_BYPASS_SECRET }, redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (response.status === 200) { const result = await response.json(); requireGate(result.mode === 'functional' && result.movementMode === mode, 'PREVIEW_MODE'); return next; }
      } catch { /* Only a read-only readiness probe may be repeated. */ }
      await pause(1000);
    }
    requireGate(false, 'PREVIEW_NOT_READY');
  } };
  try {
    await profileGate();
    campaign = createCampaign({ ...selected, operatorToken: packet.operatorToken, sourceCommit: selected.manifest.binding.sourceCommit, ownerConfig: packet.observerConfig, output: packet.outputDirectory, profileGate, lifecycle });
    await campaign.operator.call('ingress', { open: false });
    campaign.save('preflight-fingerprint-proof.json', require('./fingerprints.cjs').captureAndCompare({ ...packet, binding: selected.manifest.binding, evidenceDirectory: packet.outputDirectory }, { compareAll: true, directoryName: 'preflight-checkpoint' }));
    await campaign.baseline(); await campaign.operator.call('ingress', { open: true });
    await campaign.run(CASES);
    campaign.save('ingress-drain.json', await require('./drain.cjs').stopAndDrain({ operator: campaign.operator, observer: await campaign.owner(), runtimeUser: selected.manifest.binding.runtimeUser }));
    campaign.save('network-summary.json', campaign.network.evidence()); campaign.save('coordinator-traffic-summary.json', campaign.operator.traffic());
    require('./seals.cjs').verifySeals(selected.manifest.binding);
    // Base labels, independent oracle, all-schema metadata and fresh recovery remain distinct evidence.
    return campaign.summary('CASES_FINISHED_PENDING_INDEPENDENT_ORACLE_AND_RECOVERY');
  } finally { if (campaign) { try { await campaign.operator.call('ingress', { open: false }); } catch { campaign.save('ingress-stop-uncertain.json', { stopUncertain: true, manualReviewRequired: true }); } } await campaign?.close(); }
}
module.exports = { runPacket };
if (require.main === module) (async () => {
  try {
    const plan = require('../hosted-acceptance-plan.json'); requireGate(plan.authorization.executionEnabled === true, 'EXECUTION_DISABLED');
    requireGate(process.argv.length === 3, 'PRIVATE_PACKET_REQUIRED'); const result = await runPacket(JSON.parse(fs.readFileSync(process.argv[2]))); console.log(JSON.stringify(result));
  } catch (error) { console.error('Hosted packet stopped: ' + (error.code || 'PRIVATE_REVIEW_REQUIRED')); process.exitCode = 1; }
})();
