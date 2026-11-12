/* eslint-disable @typescript-eslint/no-require-imports -- Durable admission barrier plus actual backend reconciliation. No automatic lease expiry or backend termination. */
const { requireGate } = require('./policy.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stopAndDrain({ operator, observer, runtimeUser, clock = () => performance.now(), wait = sleep }) {
  await operator.call('ingress', { open: false });
  const visibility = await observer.query("SELECT pg_has_role(current_user,'pg_read_all_stats','USAGE') AS visible"); requireGate(visibility.rows[0]?.visible === true, 'DRAIN_VISIBILITY');
  const began = clock();
  for (;;) {
    const state = await operator.call('leases'); requireGate(state.open === false, 'DRAIN_ADMISSION_REOPENED');
    const active = await observer.query('SELECT pid,state,xact_start FROM pg_stat_activity WHERE datname=current_database() AND usename=$1', [runtimeUser]);
    requireGate(active.rows.every(row => typeof row.state === 'string'), 'DRAIN_STATE_HIDDEN');
    const pids = new Set(active.rows.map(row => row.pid));
    for (const lease of state.leases) if (!pids.has(lease.backendPid)) await operator.call('reconcile-closed-backend', { ...lease, backendAbsentVerified: true });
    const pending = (await operator.call('leases')).leases;
    if (!pending.length && active.rows.every(row => row.state === 'idle' && row.xact_start === null)) return { ingressStopped: true, ingressDrained: true, automaticallyExpiredLeases: 0 };
    requireGate(clock() - began <= 60000, 'DRAIN_TIMEOUT'); await wait(250);
  }
}
module.exports = { stopAndDrain };
