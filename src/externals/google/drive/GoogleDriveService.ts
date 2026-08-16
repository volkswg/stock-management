import {
  GOOGLE_DRIVE_API_BASE,
  GOOGLE_DRIVE_UPLOAD_URL,
  SHARED_DRIVE_SUPPORT_QUERY,
} from "./const";
import type {
  GoogleDriveConfig,
  GoogleDriveFile,
  GoogleDriveUploadImageRequest,
  IGoogleDriveService,
} from "./types";

export class GoogleDriveService implements IGoogleDriveService {
  constructor(private readonly config: GoogleDriveConfig) {}

  async uploadImage(
    input: GoogleDriveUploadImageRequest,
  ): Promise<GoogleDriveFile> {
    const boundary = `stock-management-${Date.now()}`;
    const metadata = {
      name: input.fileName,
      parents: [this.config.folderId],
    };
    const body = Buffer.concat([
      Buffer.from(
        [
          `--${boundary}`,
          "Content-Type: application/json; charset=UTF-8",
          "",
          JSON.stringify(metadata),
          `--${boundary}`,
          `Content-Type: ${input.contentType}`,
          "",
          "",
        ].join("\r\n"),
      ),
      input.bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const accessToken = await this.config.auth.getAccessToken();
    const response = await fetch(
      `${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink,webContentLink&${SHARED_DRIVE_SUPPORT_QUERY}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google Drive upload failed: ${response.status} ${errorBody}`,
      );
    }

    const driveFile = (await response.json()) as GoogleDriveFile;
    if (this.config.makeFilesReadableByLink) {
      await this.makeFileReadableByLink(driveFile.id);
    }

    return driveFile;
  }

  async makeFileReadableByLink(fileId: string): Promise<void> {
    const accessToken = await this.config.auth.getAccessToken();
    const response = await fetch(
      `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions?${SHARED_DRIVE_SUPPORT_QUERY}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google Drive permission setup failed: ${response.status} ${errorBody}`,
      );
    }
  }

  async checkConnection(): Promise<void> {
    const accessToken = await this.config.auth.getAccessToken();
    const response = await fetch(
      `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(this.config.folderId)}?fields=id,name,mimeType&${SHARED_DRIVE_SUPPORT_QUERY}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google Drive health check failed: ${response.status} ${errorBody}`,
      );
    }

    const folder = (await response.json()) as { mimeType?: string };
    if (folder.mimeType !== "application/vnd.google-apps.folder") {
      throw new Error(
        "Google Drive health check failed: configured ID is not a folder",
      );
    }
  }
}
