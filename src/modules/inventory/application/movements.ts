import type { MovementDateFilter, ProductMovementRecord, ProductMovementMasterRecord } from "../contracts";
import type { MovementStore, MovementRuntime } from "./ports/movements";
import { parseQuantity, isValidMovementQuantity, MovementQuantityRequiredError } from "../quantity";
import { matchesDateFilter, sumQuantity } from "../domain/movement-rules";
export async function listMovements({ filter, store }: {
    filter: MovementDateFilter;
    store: MovementStore;
}): Promise<ProductMovementMasterRecord[]> {
    await Promise.all([store.prepareMasters(), store.prepareDetails()]);
    const [masters, details] = await Promise.all([store.readMasters('list'), store.readDetails('list')]);
    const detailsByMaster = new Map<string, ProductMovementRecord[]>();
    for (const detail of details.records()) {
        if (!detail.movementId || !detail.movementMasterId)
            continue;
        detailsByMaster.set(detail.movementMasterId, [...(detailsByMaster.get(detail.movementMasterId) || []), detail]);
    }
    return masters.entries().map(master => { const id = master.id(); return master.project(detailsByMaster.get(id) || []); }).filter(record => record.id && matchesDateFilter(record, filter));
}
export async function getMovementItems({ store, movementMasterId }: {
    store: MovementStore;
    movementMasterId: string;
}): Promise<ProductMovementRecord[]> {
    await store.prepareDetails();
    const normalizedId = movementMasterId.toUpperCase();
    return (await store.readDetails('list')).records().filter(record => record.movementId && record.movementMasterId.toUpperCase() === normalizedId);
}
export async function movementExists({ store, movementMasterId }: {
    store: MovementStore;
    movementMasterId: string;
}): Promise<boolean> { return store.exists(movementMasterId); }
export async function deleteMovementItem({ store, movementId, movementMasterId, runtime }: {
    store: MovementStore;
    movementId: string;
    movementMasterId: string;
    runtime: MovementRuntime;
}): Promise<ProductMovementRecord[]> {
    await store.prepareDetails();
    const details = await store.readDetails('edit');
    const target = details.find(movementId, movementMasterId);
    if (target)
        await target.delete();
    await refreshMovementMaster(store, movementMasterId, runtime);
    return getMovementItems({ store, movementMasterId });
}
export async function updateMovementItem({ store, movementId, movementMasterId, quantity, remark, stockCounted, isNewArrival, runtime }: {
    store: MovementStore;
    movementId: string;
    movementMasterId: string;
    quantity?: string;
    remark?: string;
    stockCounted?: boolean;
    isNewArrival?: boolean;
    runtime: MovementRuntime;
}): Promise<ProductMovementRecord[] | null> {
    await store.prepareDetails();
    const details = await store.readDetails('edit');
    const target = details.find(movementId, movementMasterId);
    if (!target)
        return null;
    const edit = target.edit();
    if (quantity !== undefined)
        edit.quantity(quantity);
    if (remark !== undefined) {
        edit.remark(remark);
        if (remark !== target.remark()) {
            const calculated = parseQuantity(remark);
            if (calculated)
                edit.quantity(calculated.quantity);
        }
    }
    if (stockCounted !== undefined)
        edit.stockCounted(stockCounted);
    if (isNewArrival !== undefined)
        edit.isNewArrival(isNewArrival);
    edit.updatedAt(runtime.now());
    await edit.save();
    await refreshMovementMaster(store, movementMasterId, runtime);
    return getMovementItems({ store, movementMasterId });
}
export async function updateMovementImage({ store, imageUrl, movementId, movementMasterId, runtime }: {
    store: MovementStore;
    imageUrl: string;
    movementId: string;
    movementMasterId: string;
    runtime: MovementRuntime;
}): Promise<ProductMovementRecord[] | null> {
    await store.prepareDetails();
    const details = await store.readDetails('edit');
    const target = details.find(movementId, movementMasterId);
    if (!target)
        return null;
    const edit = target.edit();
    edit.image(imageUrl);
    edit.updatedAt(runtime.now());
    await edit.save();
    await refreshMovementMaster(store, movementMasterId, runtime);
    return getMovementItems({ store, movementMasterId });
}
export async function markMovementDelivered({ store, movementMasterId, runtime }: {
    store: MovementStore;
    movementMasterId: string;
    runtime: MovementRuntime;
}): Promise<{
    movementMaster: ProductMovementMasterRecord;
    records: ProductMovementRecord[];
} | null> {
    await Promise.all([store.prepareMasters(), store.prepareDetails()]);
    const [masters, details] = await Promise.all([store.readMasters('edit'), store.readDetails('edit')]);
    const normalizedId = movementMasterId.toUpperCase();
    const master = masters.find(normalizedId), selection = details.matching(normalizedId);
    if (!master || !selection.hasItems)
        return null;
    if (selection.someQuantity(quantity => !isValidMovementQuantity(quantity)))
        throw new MovementQuantityRequiredError();
    const now = runtime.now();
    await selection.deliver(now);
    const edit = master.edit();
    edit.delivered(now);
    await edit.save();
    const records = await getMovementItems({ store, movementMasterId });
    return { movementMaster: edit.project(records), records };
}
async function refreshMovementMaster(store: MovementStore, movementMasterId: string, runtime: MovementRuntime): Promise<void> {
    await store.prepareMasters();
    const [masters, items] = await Promise.all([store.readMasters('edit'), getMovementItems({ store, movementMasterId })]);
    const master = masters.find(movementMasterId);
    if (!master)
        return;
    const edit = master.edit();
    edit.quantity(String(sumQuantity(items)));
    edit.updatedAt(runtime.now());
    await edit.save();
}
