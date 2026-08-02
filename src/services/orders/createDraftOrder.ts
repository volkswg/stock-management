import {
  lastColumnLetter,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";
import { ORDERS_SHEET_HEADERS } from "@/externals/google/sheet/sheets/orders/const";
import { USER_STATE_SHEET_HEADERS } from "@/externals/google/sheet/sheets/user-state/const";

export type DraftOrder = {
  id: string;
  status: "draft";
  seller: string;
  totalPrice: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  createdBy: string;
  remark: string;
};

type UserState = {
  id: string;
  userId: string;
  flowname: "OrderCreate";
  state: "draft";
  createdAt: string;
  updatedAt: string;
};

export async function createDraftOrder({
  googleSheetsService,
  createdBy,
}: {
  googleSheetsService: IGoogleSheetsService;
  createdBy: string;
}): Promise<DraftOrder> {
  const id = await getNextOrderRowNumber(googleSheetsService);
  const now = new Date().toISOString();
  const order: DraftOrder = {
    id: String(id),
    status: "draft",
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
  now,
}: {
  googleSheetsService: IGoogleSheetsService;
  userId: string;
  now: string;
}): Promise<UserState> {
  const id = await getNextUserStateRowNumber(googleSheetsService);
  const userState: UserState = {
    id: String(id),
    userId,
    flowname: "OrderCreate",
    state: "draft",
    createdAt: now,
    updatedAt: now,
  };

  await googleSheetsService.userState.appendRows(getUserStateAppendRange(), [
    [
      userState.id,
      userState.userId,
      userState.flowname,
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
