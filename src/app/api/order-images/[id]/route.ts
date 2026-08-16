import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleDriveServiceFromConfig } from "@/externals/google/drive";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { findOrderProductImageById } from "@/services/orders";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    const config = getConfig();
    const googleSheetsService = createGoogleSheetsServiceFromConfig(config);
    const productImage = await findOrderProductImageById({
      googleSheetsService,
      imageId: id,
    });
    if (!productImage) {
      return NextResponse.json(
        { error: "Product image not found." },
        { status: 404 },
      );
    }

    const driveFileId = getGoogleDriveFileId(productImage.imageUrl);
    const googleDriveService = createGoogleDriveServiceFromConfig(config);
    if (!driveFileId || !googleDriveService) {
      return NextResponse.json(
        { error: "Product image download is not available." },
        { status: 503 },
      );
    }

    const file = await googleDriveService.downloadFile(driveFileId);
    const extension = getImageExtension(file.contentType);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="product-image-${sanitizeFileName(id)}${extension}"`,
        "Content-Type": file.contentType,
      },
    });
  } catch (error) {
    console.error("Failed to download order product image", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to download product image." },
      { status: 500 },
    );
  }
}

function getGoogleDriveFileId(imageUrl: string): string | undefined {
  return imageUrl.match(/\/file\/d\/([^/]+)/)?.[1];
}

function getImageExtension(contentType: string): string {
  switch (contentType.split(";")[0].trim().toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/jpeg":
    default:
      return ".jpg";
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
