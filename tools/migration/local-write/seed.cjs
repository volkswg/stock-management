/* eslint-disable @typescript-eslint/no-require-imports -- Copy-only synthetic fixture generation through actual application/persistence owners. */
const fs = require('node:fs');
const env = JSON.parse(fs.readFileSync(process.argv[2]));
for (const k of Object.keys(process.env))
    delete process.env[k];
Object.assign(process.env, env);
const { validate, install } = require('./runtime.cjs');
const m = JSON.parse(fs.readFileSync(env.STOCK_WRITE_MANIFEST));
validate(env, m);
const restore = install();
require('../../../tests/helpers/postgres-runtime.cjs');
const { transaction, closePool } = require('../../../src/infrastructure/persistence/postgres/database.ts'), { createPostgresService } = require('../../../src/composition/postgres/service.ts'), inventory = require('../../../src/modules/inventory/server.ts');
(async () => { try {
    const identity = JSON.parse(fs.readFileSync(process.argv[3]));
    if (!identity.masterId?.startsWith('WT_') || identity.userId !== 'WT_seed' || identity.startedAt !== '2026-01-01T01:00:00.000Z')
        throw Error('Unapproved seed');
    await transaction(true, async () => { const service = createPostgresService(); await inventory.synchronizeMovementJourney(service, identity); await inventory.appendMovementJourneyItem(service, () => ({ id: identity.masterId + '_ITEM', masterId: identity.masterId, shop: 'WT Shop A', quantity: '3', remark: 'WT seed', fromLocation: '', toLocation: '', imageUrl: m.appOrigin + '/__wt/images/WT_fixture', purchaseDetailId: '', status: 'created', createdAt: identity.startedAt, updatedAt: identity.startedAt, stockCounted: true, isNewArrival: true })); await inventory.synchronizeMovementJourney(service, identity, true); });
    console.log(JSON.stringify({ syntheticFixtureSeeded: true }));
}
catch (e) {
    console.error('Copy-only fixture seed failed; private diagnostics required.', e.name);
    process.exitCode = 1;
}
finally {
    await closePool();
    restore();
} })();
