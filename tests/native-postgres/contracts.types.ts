import type { BusinessDatabase } from "../../src/composition/postgres/service";
import type { OrderListItem, CreatedOrder, OrderDetail } from "../../src/modules/orders/contracts";
import type { Employee, EmployeeTimesheet } from "../../src/modules/hr/contracts";
import type { MovementJourneyItem } from "../../src/modules/inventory/contracts";
import type { MovementEventClassification } from "../../src/modules/line-workflows/contracts";
import type * as orders from "../../src/modules/orders/server";
import type * as hr from "../../src/modules/hr/server";
import type { RecordStore } from "../../src/infrastructure/persistence/postgres/native-records";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type NativeContracts = [
  Assert<Equal<ReturnType<typeof orders.listOrders>, Promise<OrderListItem[]>>>,
  Assert<Equal<ReturnType<typeof orders.createOrder>, Promise<CreatedOrder>>>,
  Assert<Equal<ReturnType<typeof orders.getOrderDetail>, Promise<OrderDetail | undefined>>>,
  Assert<Equal<ReturnType<typeof hr.listEmployees>, Promise<Employee[]>>>,
  Assert<Equal<ReturnType<typeof hr.listEmployeeTimesheets>, Promise<EmployeeTimesheet[]>>>,
  Assert<Equal<MovementEventClassification["session"]["photoItems"], MovementJourneyItem[] | undefined>>,
  Assert<Equal<Parameters<typeof orders.createOrder>[0]["storage"]["orders"], RecordStore>>,
];
export function nativeStorageTypes(database: BusinessDatabase) {
  // @ts-expect-error Positional worksheet methods are not business storage.
  database.orders.readRows("A:I");
  // @ts-expect-error Named numeric fields cannot accept objects.
  database.orders.insert({ id: "synthetic", totalPrice: {} });
  // @ts-expect-error Feature-owned SQL column maps do not accept unknown fields.
  database.orders.insert({ id: "synthetic", arbitraryColumn: "no" });
}
