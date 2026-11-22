/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic integration composition of actual current session owners. */
require('./postgres-runtime.cjs');
const sessions = require('../../src/modules/line-workflows/application/sessions.ts');
const { createSessionAdapter } = require('../../src/modules/line-workflows/infrastructure/postgres/sessions.ts');
const { createMovementJourneyAdapter } = require('../../src/modules/inventory/server.ts');
const orders = require('../../src/modules/orders/server.ts');
const { createWorkflowRuntime } = require('../../src/modules/line-workflows/infrastructure/runtime.ts');
const { createSortableId } = require('../../src/infrastructure/runtime/create-sortable-id.ts');
const runtime = createWorkflowRuntime(createSortableId);
function context(storage) {
  const adapter = createSessionAdapter(storage, createMovementJourneyAdapter(storage));
  return { sessions: adapter.orders, movements: adapter.movements, orders: {
    draft: createdBy => orders.createDraftRecord({ storage, createdBy }),
    transition: orderId => orders.prepareOrderTransition({ storage, orderId }),
  } };
}
exports.findLatestUserState = ({ storage, userId, flowname }) => context(storage).sessions.findLatest(userId, flowname);
exports.createDraftOrder = ({ storage, createdBy }) => sessions.createDraftOrder(context(storage), createdBy);
exports.saveMovementState = (storage, state) => sessions.saveMovementState(context(storage).movements, state, runtime);
exports.completeOrderBill = ({ storage, ...input }) => sessions.completeOrderBill(context(storage), input, runtime);
exports.completeOrderTotalPrice = ({ storage, ...input }) => sessions.completeOrderTotalPrice(context(storage), input, runtime);
