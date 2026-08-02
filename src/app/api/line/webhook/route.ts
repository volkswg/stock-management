import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import {
  LineBotService,
  type LineEvent,
  type LineWebhookPayload,
} from "@/externals/line";
import {
  classifyLineTextCommand,
  handleLineEvent,
  LineTextCommand,
} from "@/services/line";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const config = getConfig();
  const lineBotService = new LineBotService(
    config.line.channelAccessToken,
    config.line.channelSecret,
  );
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

  const legacyEvents = (payload.events || []).filter(shouldProxyToLegacy);

  for (const event of payload.events || []) {
    if (legacyEvents.includes(event)) {
      continue;
    }

    try {
      await handleLineEvent({
        event,
        lineBotService,
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

  return NextResponse.json({ ok: true });
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

function shouldProxyToLegacy(event: LineEvent): boolean {
  if (event.type !== "message" || !event.message) {
    return false;
  }

  if (event.message.type === "image") {
    return true;
  }

  if (event.message.type !== "text") {
    return false;
  }

  return classifyLineTextCommand(event.message.text) === LineTextCommand.Legacy;
}
