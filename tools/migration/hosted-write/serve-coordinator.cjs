/* eslint-disable @typescript-eslint/no-require-imports -- Starts only the separately approved persistent coordinator; no provider resource creation. */
const fs = require('node:fs');
const { requireGate, assertApproval } = require('./policy.cjs');
const { createCoordinator, validateEndpoint } = require('./rpc.cjs');
function serve(packet) {
  const { plan, binding, approval } = packet; assertApproval(plan, binding, approval);
  const origin = validateEndpoint(binding.coordinatorOrigin, false);
  requireGate(packet.listenHost === binding.coordinatorListenHost && typeof packet.listenHost === 'string', 'COORDINATOR_LISTEN_BINDING');
  requireGate(packet.listenPort === binding.coordinatorListenPort && Number.isInteger(packet.listenPort) && packet.listenPort >= 1024 && packet.listenPort <= 65535, 'COORDINATOR_LISTEN_PORT');
  requireGate(packet.targetId === 'WT_' + binding.isolationId, 'COORDINATOR_TARGET');
  const runtimeConfigs = Object.fromEntries(Object.entries(packet.runtimeConfigFiles || {}).map(([id, file]) => {
    const stat = fs.lstatSync(file); requireGate(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && (stat.mode & 0o777) === 0o600, 'PRIVATE_RUNTIME_CONFIG_FILE'); return [id, JSON.parse(fs.readFileSync(file))];
  }));
  const result = createCoordinator({ ...packet, runtimeConfigs, faultTesting: binding.stage === 'F', offline: false, tls: { key: fs.readFileSync(packet.keyFile), cert: fs.readFileSync(packet.certFile) }, authorization: { plan, binding, approval } });
  for (const manifest of packet.approvedPreviews || []) result.registerPreview(manifest);
  result.server.listen(packet.listenPort, packet.listenHost);
  console.log(JSON.stringify({ coordinator: 'STARTED_APPROVED_ONLY', hostname: origin.hostname, targetBound: true })); return result;
}
module.exports = { serve };
if (require.main === module) {
  try { requireGate(require('../hosted-acceptance-plan.json').authorization.executionEnabled === true, 'EXECUTION_DISABLED'); requireGate(process.argv.length === 3, 'PRIVATE_COORDINATOR_PACKET'); serve(JSON.parse(fs.readFileSync(process.argv[2]))); }
  catch (error) { console.error('Coordinator stopped: ' + (error.code || 'PRIVATE_REVIEW_REQUIRED')); process.exitCode = 1; }
}
