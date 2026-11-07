import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import {
  LineBotService,
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
import {parseLineWebhookPayload,processLineWebhook}from "@/modules/line-workflows/server";

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

  const result=await processLineWebhook({events:payload.events,lineBotService,getGoogleSheetsService,getGoogleDriveService,getCreateMode:()=>config.movementCreateMode,getPublicBaseUrl:()=>config.movementPublicBaseUrl||config.publicBaseUrl});
  if (result.movementFailed) {
    return NextResponse.json(
      { ok: false, error: "Movement processing failed. Please retry.", images: result.imageCounts(), imageResults: result.imageUploads },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, images: result.imageCounts(), imageResults: result.imageUploads });
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
