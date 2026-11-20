import "server-only";
import type { NativeRecord, RecordValue } from "@/infrastructure/persistence/postgres/native-records";
import type { MovementJourneyItem, MovementJourneyMaster } from "../../contracts";
import type { MovementJourneyStore, MovementJourneyMasterReference } from "../../application/ports/movement-journeys";
import type { Storage } from "./storage";
export function createMovementJourneyAdapter(storage: Pick<Storage, "movementMasters" | "movementDetails">) {
  const originals = new WeakMap<MovementJourneyMasterReference, Parameters<Storage["movementMasters"]["update"]>[0]>();
  const project = (r: NativeRecord): MovementJourneyItem => ({ get id() { return r.id; }, get masterId() { return r.movementMasterId; }, get shop() { return r.shopName; }, get quantity() { return r.quantity; }, get remark() { return r.remark; }, get fromLocation() { return r.fromLocation; }, get toLocation() { return r.toLocation; }, get imageUrl() { return r.productImageUrl; }, get status() { return r.status; }, get createdAt() { return r.createdAt; }, get updatedAt() { return r.updatedAt; }, get stockCounted() { return r.stockCounted; }, get isNewArrival() { return r.isNewArrival; } });
  function itemsFor(records: NativeRecord[], readId: () => string | undefined) { return records.filter(r => r.movementMasterId === readId() && r.id).map(project); }
  function master(r: Parameters<Storage["movementMasters"]["update"]>[0]): MovementJourneyMasterReference {
    const reference = { get id() { return r.id; }, get userId() { return r.userId; }, get packingDate() { return r.packingDate; }, get deliveredAt() { return r.deliverDateTime; }, get status() { return r.status; }, get quantity() { return r.totalQuantity; }, get createdAt() { return r.createdAt; }, get updatedAt() { return r.updatedAt; } };
    originals.set(reference, r); return reference;
  }
  const masterRecord = (v: MovementJourneyMaster) => ({ id: v.id as RecordValue, userId: v.userId as RecordValue, packingDate: v.packingDate as RecordValue, deliverDateTime: v.deliveredAt as RecordValue, status: v.status as RecordValue, totalQuantity: v.quantity as RecordValue, createdAt: v.createdAt as RecordValue, updatedAt: v.updatedAt as RecordValue });
  const itemRecord = (v: MovementJourneyItem) => ({ id: v.id as RecordValue, movementMasterId: v.masterId as RecordValue, shopName: v.shop as RecordValue, quantity: v.quantity as RecordValue, remark: v.remark as RecordValue, fromLocation: v.fromLocation as RecordValue, toLocation: v.toLocation as RecordValue, productImageUrl: v.imageUrl as RecordValue, status: v.status as RecordValue, createdAt: v.createdAt as RecordValue, updatedAt: v.updatedAt as RecordValue, stockCounted: v.stockCounted as RecordValue, isNewArrival: v.isNewArrival as RecordValue });
  const store: MovementJourneyStore = {
    async readCombined() { const [records, details] = await Promise.all([storage.movementMasters.all(), storage.movementDetails.all()]); return { findMaster(readId) { const record = records.find(r => r.id === readId()); return record ? master(record) : undefined; }, items: readId => itemsFor(details, readId) }; },
    async readMasters() { return (await storage.movementMasters.all()).map(master); },
    async readItems(masterId) { return itemsFor(await storage.movementDetails.all(), () => masterId); },
    appendItem: read => storage.movementDetails.insert(itemRecord(read())), appendMaster: value => storage.movementMasters.insert(masterRecord(value)), updateMaster: (target, value) => storage.movementMasters.update(originals.get(target)!, masterRecord(value)),
  };
  return { store, async itemSnapshot() { const records = await storage.movementDetails.all(); return { items: (readId: () => string | undefined) => itemsFor(records, readId) }; } };
}
