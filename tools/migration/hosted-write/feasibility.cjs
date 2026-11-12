/* eslint-disable @typescript-eslint/no-require-imports -- Conservative offline checks, not provider billing or capacity certification. */
const { requireGate } = require('./policy.cjs');
const positive = value => Number.isSafeInteger(value) && value > 0;
function assessProfile(profile, now = Date.now()) {
  const blockers = [], check = (condition, code) => { if (!condition) blockers.push(code); };
  const telemetry = profile.telemetry || {}, budget = profile.budget || {}, connection = profile.connections || {};
  check(telemetry.entitlementVerified === true, 'METRICS_ENTITLEMENT_UNVERIFIED');
  check(positive(telemetry.sampleIntervalMs) && telemetry.sampleIntervalMs <= 1000, 'METRICS_TOO_COARSE');
  check(positive(telemetry.seriesFreshnessMs) && telemetry.seriesFreshnessMs <= 2000, 'METRICS_STALE');
  for (const scope of ['databaseMemory', 'databaseCpu', 'allAppInstances', 'driver', 'restartsAndOom', 'diskAndWal']) check(telemetry[scope] === true, 'METRICS_MISSING_' + scope.toUpperCase());
  check(telemetry.cpuWindowMs === 10000, 'CPU_WINDOW_UNPROVEN');
  for (const field of ['databaseMemoryBytes', 'appCombinedRssBytes', 'driverRssBytes', 'databaseDiskBytes']) check(positive(profile.limits?.[field]), 'LIMIT_UNSEALED_' + field.toUpperCase());
  check(connection.poolPerInstance === 2 && connection.runtimeLoginLimit === 6 && positive(connection.runtimeBackendsMaximum) && connection.runtimeBackendsMaximum <= 4, 'RUNTIME_CONNECTION_LIMIT');
  check(positive(connection.providerMaximum) && positive(connection.observedTotal) && connection.observedTotal <= Math.floor(connection.providerMaximum * .8) && connection.providerMaximum - connection.observedTotal >= 5, 'PROVIDER_CONNECTION_HEADROOM');
  check(positive(budget.remainingOrganizationBytes) && positive(budget.protectedSourceReserveBytes) && budget.protectedSourceReserveBytes >= 2000000000, 'SOURCE_EGRESS_RESERVE');
  check(positive(budget.campaignCapBytes) && budget.campaignCapBytes <= 1000000000 && positive(budget.completeForecastBytes) && budget.completeForecastBytes <= budget.campaignCapBytes && budget.completeForecastBytes + budget.protectedSourceReserveBytes <= budget.remainingOrganizationBytes, 'CAMPAIGN_EGRESS_BUDGET');
  check(Number.isFinite(now) && Number.isFinite(budget.observedAtMs) && now >= budget.observedAtMs && now - budget.observedAtMs <= 60000 && budget.includesAllCampaignTraffic === true && budget.providerMeterIndependent === true, 'BILLING_OBSERVATION_UNPROVEN');
  check(budget.incrementalSpendApproved === 0 && budget.existingHostingAllowanceVerified === true && budget.offsiteAllowanceVerified === true, 'ZERO_COST_NOT_ESTABLISHED');
  return { strictCapacity: blockers.length ? 'BLOCKED' : 'PROFILE_ELIGIBLE_NOT_TESTED', blockers, hostedCapacityPassed: false };
}
async function measurePayload(body, headers = {}) {
  const request = new Request('https://payload.invalid/api/fixture', { method: 'POST', body, headers });
  const bytes = (await request.arrayBuffer()).byteLength;
  return { serializedBodyBytes: bytes, contentType: request.headers.get('content-type'), platformBodyBudgetBytes: 4500000, fitsConservativePlatformBudget: bytes <= 4500000, hostedBoundaryTested: false };
}
class TrafficBudget {
  constructor({ capBytes, responseMaximumBytes, overheadPerRequestBytes = 4096 }) {
    requireGate(positive(capBytes) && capBytes <= 1000000000 && positive(responseMaximumBytes) && positive(overheadPerRequestBytes), 'TRAFFIC_LIMITS');
    Object.assign(this, { capBytes, responseMaximumBytes, overheadPerRequestBytes, chargedBytes: 0, reservedBytes: 0, requests: 0, stopped: false });
  }
  reserve(requestBytes) {
    requireGate(!this.stopped && Number.isSafeInteger(requestBytes) && requestBytes >= 0, 'TRAFFIC_STOPPED');
    const maximum = requestBytes + this.responseMaximumBytes + this.overheadPerRequestBytes;
    requireGate(this.chargedBytes + this.reservedBytes + maximum <= this.capBytes, 'TRAFFIC_CAP');
    this.reservedBytes += maximum; this.requests++;
    let completed = false;
    return responseBytes => {
      requireGate(!completed, 'DUPLICATE_TRAFFIC_SETTLEMENT'); completed = true;
      this.reservedBytes -= maximum;
      if (!Number.isSafeInteger(responseBytes) || responseBytes < 0 || responseBytes > this.responseMaximumBytes) {
        this.chargedBytes += maximum; this.stopped = true; requireGate(false, 'RESPONSE_OR_TRANSPORT_UNCERTAIN');
      }
      this.chargedBytes += requestBytes + responseBytes + this.overheadPerRequestBytes;
    };
  }
  snapshot() { return { chargedBytes: this.chargedBytes, reservedBytes: this.reservedBytes, requests: this.requests, stopped: this.stopped, scope: 'APP_HTTP_ONLY_NOT_DATABASE_WIRE_OR_PROVIDER_BILLING' }; }
}
module.exports = { assessProfile, measurePayload, TrafficBudget };
