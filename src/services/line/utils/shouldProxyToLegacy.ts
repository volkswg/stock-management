import { LineMessageType, type LineEvent } from "@/externals/line";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import {
  isOrderImageUploadState,
  OrderStatus,
  UserStateFlowName,
} from "@/services/orders";
import type { UserState } from "@/services/user-states";
import { LineTextCommand } from "../enum";
import { classifyLineTextCommand } from "../text";
import { resolveUserState } from "./resolveUserState";

type LegacyProxyContext = {
  event: LineEvent;
  getGoogleSheetsService: () => IGoogleSheetsService;
  resolvedUserStates: Map<LineEvent, UserState>;
};

export async function shouldProxyToLegacy({
  event,
  getGoogleSheetsService,
  resolvedUserStates,
}: LegacyProxyContext): Promise<boolean> {
  if (event.type !== "message" || !event.message) {
    return false;
  }

  switch (event.message.type) {
    case LineMessageType.Image:
      return shouldProxyImageToLegacy({
        event,
        getGoogleSheetsService,
        resolvedUserStates,
      });

    case LineMessageType.Text:
      return shouldProxyTextToLegacy({
        event,
        getGoogleSheetsService,
        resolvedUserStates,
        text: event.message.text,
      });

    default:
      return false;
  }
}

async function shouldProxyImageToLegacy({
  event,
  getGoogleSheetsService,
  resolvedUserStates,
}: LegacyProxyContext): Promise<boolean> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    return true;
  }

  try {
    const latestUserState = await resolveUserState({
      event,
      flowname: UserStateFlowName.OrderCreate,
      getGoogleSheetsService,
      resolvedUserStates,
    });
    return !isOrderImageUploadState(latestUserState?.state);
  } catch (error) {
    console.error("Failed to check LINE pending user state", {
      webhookEventId: event.webhookEventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

async function shouldProxyTextToLegacy({
  event,
  getGoogleSheetsService,
  resolvedUserStates,
  text,
}: LegacyProxyContext & { text: string | undefined }): Promise<boolean> {
  const command = classifyLineTextCommand(text);
  if (command !== LineTextCommand.Legacy) {
    return false;
  }

  const lineUserId = event.source?.userId;
  if (!lineUserId) {
    return true;
  }

  try {
    const latestUserState = await resolveUserState({
      event,
      flowname: UserStateFlowName.OrderCreate,
      getGoogleSheetsService,
      resolvedUserStates,
    });
    return latestUserState?.state !== OrderStatus.WaitingForTotalPrice;
  } catch (error) {
    console.error("Failed to check LINE text user state", {
      webhookEventId: event.webhookEventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}
