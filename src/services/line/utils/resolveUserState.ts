import type { LineEvent } from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import type { UserStateFlowName } from "@/services/orders";
import {
  findLatestUserState,
  type UserState,
} from "@/services/user-states";

export async function resolveUserState({
  event,
  flowname,
  getGoogleSheetsService,
  resolvedUserStates,
}: {
  event: LineEvent;
  flowname: UserStateFlowName;
  getGoogleSheetsService: () => IGoogleSheetsService;
  resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<UserState | undefined> {
  const resolvedUserState = resolvedUserStates.get(event);
  if (resolvedUserState?.flowname === flowname) {
    return resolvedUserState;
  }

  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    return undefined;
  }

  const latestUserState = await findLatestUserState({
    googleSheetsService: getGoogleSheetsService(),
    userId: lineUserId,
    flowname,
  });
  if (latestUserState) {
    resolvedUserStates.set(event, latestUserState);
  }

  return latestUserState;
}
