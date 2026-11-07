import type { MovementJourneyIdentity, MovementJourneyItem, MovementJourneyMaster } from "../contracts";
import type { MovementJourneyStore } from "./ports/movement-journeys";
import { journeyMasterQuantity } from "../domain/journey-quantities";
export async function movementJourneyItems(store: MovementJourneyStore, masterId: string) { return store.readItems(masterId); }
export async function appendMovementJourneyItem(store: MovementJourneyStore, readItem: () => MovementJourneyItem) { await store.appendItem(readItem); }
export async function synchronizeMovementJourney(store: MovementJourneyStore, state: MovementJourneyIdentity, complete: boolean, now: () => string): Promise<MovementJourneyItem[]> {
    const snapshot = await store.readCombined(), existing = snapshot.findMaster(() => state.masterId), items = snapshot.items(() => state.masterId);
    const total = journeyMasterQuantity(items);
    const value: MovementJourneyMaster = { id: state.masterId, userId: state.userId, packingDate: existing?.packingDate || state.startedAt, deliveredAt: existing?.deliveredAt || "", status: existing?.status === "delivered" ? "delivered" : complete || existing?.status === "created" ? "created" : "in_progress", quantity: String(total), createdAt: existing?.createdAt || state.startedAt, updatedAt: now() };
    if (!existing)
        await store.appendMaster(value);
    else
        await store.updateMaster(existing, value);
    return items;
}
export async function findResumableMovementJourney(store: MovementJourneyStore, userId: string) {
    const master = (await store.readMasters()).filter(row => row.userId === userId && row.status === "in_progress").sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    if (!master)
        return undefined;
    const masterId = String(master.id), items = await store.readItems(masterId);
    return { masterId, items, startedAt: () => String(master.createdAt || master.packingDate) };
}
