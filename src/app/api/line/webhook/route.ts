import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import {
  LineBotService,
  type LineEvent,
  type LineWebhookPayload,
} from "@/externals/line";
import {
  createGoogleDriveServiceFromConfig,
  type IGoogleDriveService,
} from "@/externals/google/drive";
import {
  createGoogleSheetsServiceFromConfig,
  type IGoogleSheetsService,
} from "@/externals/google/sheet";
import {
  handleLineEvent,
  shouldProxyToLegacy,
} from "@/services/line";
import { handleMovementEvent } from "@/services/movements/createMovement";
import type { UserState } from "@/services/user-states";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const config = getConfig();
  const lineBotService = new LineBotService(
    config.line.channelAccessToken,
    config.line.channelSecret,
  );
  const getGoogleSheetsService = createGoogleSheetsServiceGetter(config);
  const getGoogleDriveService = createGoogleDriveServiceGetter(config);
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-line-signature") || undefined;

  if (!lineBotService.verifyLineSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: "Invalid LINE signature" },
      { status: 401 },
    );
  }

  let payload: LineWebhookPayload;
  try {
    payload = parseLineWebhookPayload(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid LINE webhook payload" },
      { status: 400 },
    );
  }

  console.log("LINE webhook received", {
    eventCount: payload.events?.length || 0,
  });

  const resolvedUserStates = new Map<LineEvent, UserState>();
  const legacyEvents: LineEvent[] = [];
  let movementFailed = false;
  for (const event of payload.events || []) {
    // Route and handle sequentially: earlier events may advance a Sheets checkpoint.
    try {
      if (await handleMovementEvent({
        event,
        sheets: getGoogleSheetsService(),
        drive: getGoogleDriveService,
        line: lineBotService,
        publicBaseUrl: config.movementPublicBaseUrl ||
          (config.line.legacyWebhookUrl ? new URL(config.line.legacyWebhookUrl).origin : ""),
      })) continue;
    } catch (error) {
      console.error("Failed to process movement event", {
        webhookEventId: event.webhookEventId,
        error: error instanceof Error ? error.message : String(error),
      });
      movementFailed = true;
      // Do not route a possibly active movement to the legacy purchase flow.
      break;
    }

    if (await shouldProxyToLegacy({ event, getGoogleSheetsService, resolvedUserStates })) {
      legacyEvents.push(event);
      continue;
    }
    try {
      await handleLineEvent({
        event, lineBotService, getGoogleSheetsService, getGoogleDriveService, resolvedUserStates,
      });
    } catch (error) {
      console.error("Failed to process LINE event", {
        webhookEventId: event.webhookEventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (legacyEvents.length > 0) {
    if (!config.line.legacyWebhookUrl) {
      console.warn("LINE legacy webhook proxy skipped: URL is not configured", {
        eventCount: legacyEvents.length,
      });
    } else {
      await proxyLegacyLineWebhook({
        legacyWebhookUrl: config.line.legacyWebhookUrl,
        channelSecret: config.line.channelSecret,
        events: legacyEvents,
      });
    }
  }

  if (movementFailed) {
    return NextResponse.json({ error: "Movement processing failed. Please retry." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

function createGoogleDriveServiceGetter(
  config: ReturnType<typeof getConfig>,
): () => IGoogleDriveService | undefined {
  let googleDriveService: IGoogleDriveService | undefined;

  return () => {
    googleDriveService ||= createGoogleDriveServiceFromConfig(config);
    return googleDriveService;
  };
}

function createGoogleSheetsServiceGetter(
  config: ReturnType<typeof getConfig>,
): () => IGoogleSheetsService {
  let googleSheetsService: IGoogleSheetsService | undefined;

  return () => {
    googleSheetsService ||= createGoogleSheetsServiceFromConfig(config);
    return googleSheetsService;
  };
}

async function proxyLegacyLineWebhook({
  legacyWebhookUrl,
  channelSecret,
  events,
}: {
  legacyWebhookUrl: string;
  channelSecret: string;
  events: LineEvent[];
}): Promise<void> {
  const body = JSON.stringify({ events });
  const signature = crypto
    .createHmac("sha256", channelSecret)
    .update(body)
    .digest("base64");
  const response = await fetch(legacyWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-line-signature": signature,
    },
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Legacy LINE webhook proxy failed: ${response.status} ${responseBody}`,
    );
  }
}

function parseLineWebhookPayload(rawBody: Buffer): LineWebhookPayload {
  const payload = JSON.parse(rawBody.toString("utf8")) as unknown;

  if (!isRecord(payload)) {
    return {};
  }

  return {
    events: Array.isArray(payload.events)
      ? payload.events.filter(isLineEvent)
      : undefined,
  };
}

function isLineEvent(value: unknown): value is LineEvent {
  return isRecord(value) && typeof value.type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
