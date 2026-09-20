import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleDriveServiceFromConfig } from "@/externals/google/drive";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { updateMovementImage } from "@/services/movements";

export const runtime = "nodejs";
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
): Promise<NextResponse> {
  const { id, itemId } = await params;
  const movementMasterId = id.trim();
  const movementId = itemId.trim();
  const contentType = request.headers.get("content-type")?.split(";")[0] || "";
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!movementMasterId || !movementId) {
    return NextResponse.json(
      { error: "Movement and item IDs are required." },
      { status: 400 },
    );
  }
  if (!contentType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Select an image file." },
      { status: 415 },
    );
  }
  if (contentLength > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Image must be 20 MB or smaller." },
      { status: 413 },
    );
  }

  const config = getConfig();
  const googleDriveService = createGoogleDriveServiceFromConfig(config);
  if (!googleDriveService) {
    return NextResponse.json(
      { error: "Google Drive is not configured." },
      { status: 503 },
    );
  }

  try {
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json(
        { error: "Image file is required." },
        { status: 400 },
      );
    }
    if (bytes.length > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 20 MB or smaller." },
        { status: 413 },
      );
    }
    const uploaded = await googleDriveService.uploadImage({
      bytes,
      contentType,
      fileName: movementImageName(movementMasterId, movementId, contentType),
    });
    const records = await updateMovementImage({
      googleSheetsService: createGoogleSheetsServiceFromConfig(config),
      imageUrl: uploaded.webViewLink,
      movementId,
      movementMasterId,
    });
    if (!records) {
      await googleDriveService.deleteFile(uploaded.id);
      return NextResponse.json(
        { error: "Movement item was not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      record: records.find(
        (record) => record.movementId.toUpperCase() === movementId.toUpperCase(),
      ),
      records,
    });
  } catch (error) {
    console.error("Failed to update movement image", {
      error: error instanceof Error ? error.message : String(error),
      movementId,
      movementMasterId,
    });
    return NextResponse.json(
      { error: "Failed to update movement image." },
      { status: 500 },
    );
  }
}

function movementImageName(
  movementMasterId: string,
  movementId: string,
  contentType: string,
): string {
  const extension =
    contentType === "image/png"
      ? ".png"
      : contentType === "image/webp"
        ? ".webp"
        : ".jpg";
  const safeId = `${movementMasterId}-${movementId}`.replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
  return `movement-${safeId}-${Date.now()}${extension}`;
}
