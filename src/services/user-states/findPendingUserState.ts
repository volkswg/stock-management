import type {
  GoogleSheetRow,
  IGoogleSheetsService,
} from "@/externals/google/sheet";
import { OrderStatus, UserStateFlowName } from "@/services/orders";

export type UserState = {
  id: string;
  userId: string;
  flowname: UserStateFlowName;
  referenceId: string;
  state: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export async function findPendingUserState({
  googleSheetsService,
  userId,
}: {
  googleSheetsService: IGoogleSheetsService;
  userId: string;
}): Promise<UserState | undefined> {
  const rows = await googleSheetsService.userState.readRows();

  return rows
    .map(mapUserStateRow)
    .filter((userState): userState is UserState => Boolean(userState))
    .reverse()
    .find(
      (userState) =>
        userState.userId === userId &&
        userState.flowname === UserStateFlowName.OrderCreate &&
        userState.state === OrderStatus.WaitingForBillImage,
    );
}

export async function hasPendingUserState({
  googleSheetsService,
  userId,
}: {
  googleSheetsService: IGoogleSheetsService;
  userId: string;
}): Promise<boolean> {
  const userState = await findPendingUserState({
    googleSheetsService,
    userId,
  });
  return Boolean(userState);
}

function mapUserStateRow(row: GoogleSheetRow): UserState | undefined {
  const [id, userId, flowname, referenceId, state, createdAt, updatedAt] = row;

  if (
    typeof id !== "string" ||
    typeof userId !== "string" ||
    typeof flowname !== "string" ||
    typeof referenceId !== "string" ||
    typeof state !== "string"
  ) {
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
