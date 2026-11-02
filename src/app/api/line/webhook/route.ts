import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import {
  LineBotService,
  LineMessageType,
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
import { handleLineEvent } from "@/services/line";
import { handleMovementEvent, type MovementImageUploadProgress } from "@/features/backend/line/services/movements";
import type { UserState } from "@/services/user-states";
import {
  classifyLineEvent,
  parseLineWebhookPayload,
} from "@/features/backend/line/utils";

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
  let movementFailed = false;
  const imageUploads: MovementImageUploadProgress[] = [];
  const receivedImages = (payload.events || []).filter((event) => event.message?.type === LineMessageType.Image).length;
  let attemptedImages = 0;
  let otherFlowImages = 0;
  let failedBeforeRouting = 0;
  const imageCounts = () => ({
    scope: "movement",
    received: receivedImages,
    routedToMovement: imageUploads.length,
    otherFlows: otherFlowImages,
    unprocessed: receivedImages - attemptedImages,
    failedBeforeRouting,
    uploaded: imageUploads.filter((image) => image.uploaded).length,
    saved: imageUploads.filter((image) => image.saved).length,
    alreadySaved: imageUploads.filter((image) => image.alreadySaved).length,
    completed: imageUploads.filter((image) => image.completed).length,
    failed: imageUploads.filter((image) => image.failed).length + failedBeforeRouting,
    ignored: imageUploads.filter((image) => image.ignored).length,
    saveUncertain: imageUploads.filter((image) => image.saveUncertain).length,
  });
  for (const event of payload.events || []) {
    let imageUpload: MovementImageUploadProgress | undefined;
    if (event.message?.type === LineMessageType.Image) attemptedImages++;
    // Route and handle sequentially: earlier events may advance a Sheets checkpoint.
    try {
      const classification = await classifyLineEvent({
        event,
        getGoogleSheetsService,
      });
      if (classification.kind === "movement") {
        if (classification.event.message.type === LineMessageType.Image) {
          imageUpload = {
            messageId: classification.event.message.id, uploaded: false, saved: false,
            alreadySaved: false, completed: false, failed: false, ignored: false, saveUncertain: false,
          };
          imageUploads.push(imageUpload);
        }
        await handleMovementEvent({
          event: classification.event,
          session: classification.session,
          sheets: getGoogleSheetsService(),
          drive: getGoogleDriveService,
          line: lineBotService,
          createMode: config.movementCreateMode,
          imageUpload,
          publicBaseUrl: config.movementPublicBaseUrl || config.publicBaseUrl,
        });
        continue;
      }
      if (event.message?.type === LineMessageType.Image) otherFlowImages++;
    } catch (error) {
      if (imageUpload) imageUpload.failed = true;
      else if (event.message?.type === LineMessageType.Image) failedBeforeRouting++;
      console.error("Failed to process movement event", {
        webhookEventId: event.webhookEventId,
        error: error instanceof Error ? error.message : String(error),
      });
      movementFailed = true;
      // Stop the batch so later events cannot advance a failed movement.
      break;
    }

    try {
      await handleLineEvent({
        event,
        lineBotService,
        getGoogleSheetsService,
        getGoogleDriveService,
        resolvedUserStates,
      });
    } catch (error) {
      console.error("Failed to process LINE event", {
        webhookEventId: event.webhookEventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (movementFailed) {
    return NextResponse.json(
      { ok: false, error: "Movement processing failed. Please retry.", images: imageCounts(), imageResults: imageUploads },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, images: imageCounts(), imageResults: imageUploads });
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
