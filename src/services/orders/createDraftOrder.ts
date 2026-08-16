import {
  lastColumnLetter,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";
import { ORDERS_SHEET_HEADERS } from "@/externals/google/sheet/sheets/orders/const";
import { USER_STATE_SHEET_HEADERS } from "@/externals/google/sheet/sheets/user-state/const";

export type Order = {
  id: string;
  status: OrderStatus;
  seller: string;
  totalPrice: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
  remark: string;
};

export enum OrderStatus {
  WaitingForBillImage = "waiting_for_bill_image",
  WaitingForProductImage = "waiting_for_product_image",
  WaitingForTotalPrice = "waiting_for_total_price",
  Complete = "complete",
  Paid = "paid",
  Shipped = "shipped",
  Delivered = "delivered",
  Canceled = "canceled",
}

export enum UserStateFlowName {
  OrderCreate = "OrderCreate",
}

type UserState = {
  id: string;
  userId: string;
  flowname: UserStateFlowName;
  referenceId: string;
  state: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export async function createDraftOrder({
  googleSheetsService,
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  createdBy: string;
}): Promise<Order> {
  const id = await getNextOrderRowNumber(googleSheetsService);
  const now = new Date().toISOString();
  const order: Order = {
    id: String(id),
    status: OrderStatus.WaitingForBillImage,
    seller: "",
    totalPrice: "",
    createdAt: now,
    updatedAt: now,
    deletedAt: "",
    createdBy,
    remark: "",
  };

  await googleSheetsService.orders.appendRows(getOrdersAppendRange(), [
    [
      order.id,
      order.status,
      order.seller,
      order.totalPrice,
      order.remark,
      order.createdAt,
      order.updatedAt,
      order.deletedAt,
      order.createdBy,
    ],
  ]);

  await createOrderUserState({
    googleSheetsService,
    userId: createdBy,
    referenceId: order.id,
    now,
  });

  return order;
}

function getOrdersAppendRange(): string {
  return `A:${lastColumnLetter(ORDERS_SHEET_HEADERS.length - 1)}`;
}

async function getNextOrderRowNumber(
  googleSheetsService: IGoogleSheetsService,
): Promise<number> {
  const rows = await googleSheetsService.orders.readRows("A:A");
  return rows.length + 1;
}

async function createOrderUserState({
  googleSheetsService,
  userId,
  referenceId,
  now,
}: {
  googleSheetsService: IGoogleSheetsService;
  userId: string;
  referenceId: string;
  now: string;
}): Promise<UserState> {
  const id = await getNextUserStateRowNumber(googleSheetsService);
  const userState: UserState = {
    id: String(id),
    userId,
    flowname: UserStateFlowName.OrderCreate,
    referenceId,
    state: OrderStatus.WaitingForBillImage,
    createdAt: now,
    updatedAt: now,
  };

  await googleSheetsService.userState.appendRows(getUserStateAppendRange(), [
    [
      userState.id,
      userState.userId,
      userState.flowname,
      userState.referenceId,
      userState.state,
      userState.createdAt,
      userState.updatedAt,
    ],
  ]);

  return userState;
}

function getUserStateAppendRange(): string {
  return `A:${lastColumnLetter(USER_STATE_SHEET_HEADERS.length - 1)}`;
}

async function getNextUserStateRowNumber(
  googleSheetsService: IGoogleSheetsService,
): Promise<number> {
  const rows = await googleSheetsService.userState.readRows("A:A");
  return rows.length + 1;
}
