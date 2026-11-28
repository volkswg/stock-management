import "server-only";
import type { NativeRecord, RecordValue } from "@/infrastructure/persistence/postgres/native-records";
import { OrderStatus } from "@/modules/orders/contracts";
import type { MovementJourneyItem } from "@/modules/inventory/contracts";
import { MOVEMENT_FLOW, UserStateFlowName, type UserState } from "../../contracts";
import type { OrderSessionStore, MovementSessionStore, MovementSessionSnapshot, SessionEntry } from "../../application/ports/workflows";
import type { Storage } from "./storage";
type ItemSnapshot = { items(readId: () => string | undefined): MovementJourneyItem[] };
export function createSessionAdapter(storage: Pick<Storage, "userState">, inventory: { itemSnapshot(masterIds: string[]): Promise<ItemSnapshot> }) {
  type Record = Parameters<Storage["userState"]["update"]>[0];
  async function snapshot(records: Record[]): Promise<MovementSessionSnapshot> {
    const originals = new WeakMap<SessionEntry, Record>();
    function entry(record: Record): SessionEntry {
      const value = { get id() { return record.id; }, get referenceId() { return record.referenceId; }, get step() { return record.state; }, get createdAt() { return record.createdAt; }, get context() { return record.context; } }; originals.set(value, record); return value;
    }
    return {
      latestForReading(userId) { const record = records.find(r => r.userId === userId && r.flowname === MOVEMENT_FLOW); return record ? entry(record) : undefined; },
      findForWriting(readUserId) { const record = records.find(r => r.userId === readUserId() && r.flowname === MOVEMENT_FLOW); return record ? entry(record) : undefined; },
      nextIdentifier: () => storage.userState.reserveIdentifier(),
      async eraseMovement(userId) { for (const record of records.filter(r => r.userId === userId && r.flowname === MOVEMENT_FLOW)) await storage.userState.softDelete(record); },
      async writeMovement(target, value) {
        const record = { id: value.id as RecordValue, userId: value.userId, flowname: value.flowname, referenceId: value.referenceId, state: value.state, createdAt: value.createdAt as RecordValue, updatedAt: value.updatedAt, context: value.context };
        if (target) await storage.userState.update(originals.get(target)!, record); else await storage.userState.insert(record);
      },
    };
  }
  const orders: OrderSessionStore = {
    async findLatest(userId, flowname) { return (await storage.userState.select('t."userId"=$1 AND t.flowname=$2',[userId,flowname],"descending")).map(mapUserStateRow).filter((v): v is UserState => Boolean(v)).find(v => v.userId === userId && v.flowname === flowname); },
    nextIdentifier: () => storage.userState.reserveIdentifier(),
    append: value => storage.userState.insert({ id: value.id, userId: value.userId, flowname: value.flowname, referenceId: value.referenceId, state: value.state, createdAt: value.createdAt, updatedAt: value.updatedAt }),
    reference(id) {
      let reference: Promise<Record> | undefined;
      function required() { return reference ??= storage.userState.find(id).then(record => { if (!record) throw new Error("User state no longer exists."); return record; }); }
      return { update: async (state, createdAt, now) => storage.userState.update(await required(), { state, createdAt, updatedAt: now }), clear: async () => storage.userState.softDelete(await required()) };
    },
  };
  const movements: MovementSessionStore = { async read(userId) { return snapshot(await storage.userState.select('t."userId"=$1 AND t.flowname=$2',[userId,MOVEMENT_FLOW],"descending")); } };
  return { orders, movements, async photoContext(userId: string) {
    const users = await storage.userState.select('t."userId"=$1 AND t.flowname=$2',[userId,MOVEMENT_FLOW],"descending");
    const items = await inventory.itemSnapshot(users.map(row => String(row.referenceId ?? "")));
    return { sessions: await snapshot(users), items: items.items };
  } };
}
function mapUserStateRow(row: NativeRecord): UserState | undefined {
    const { id, userId, flowname, referenceId, state, createdAt, updatedAt } = row;
    if (typeof id !== "string" ||
        typeof userId !== "string" ||
        typeof flowname !== "string" ||
        typeof referenceId !== "string" ||
        typeof state !== "string") {
        return undefined;
    }
    if (!isUserStateFlowName(flowname) || !isOrderStatus(state)) {
        return undefined;
    }
    return {
        id,
        userId,
        flowname,
        referenceId,
        state,
        createdAt: typeof createdAt === "string" ? createdAt : "",
        updatedAt: typeof updatedAt === "string" ? updatedAt : "",
    };
}
function isUserStateFlowName(value: string): value is UserStateFlowName {
    return Object.values(UserStateFlowName).includes(value as UserStateFlowName);
}
function isOrderStatus(value: string): value is OrderStatus {
    return Object.values(OrderStatus).includes(value as OrderStatus);
}
