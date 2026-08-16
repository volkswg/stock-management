import type { IGoogleAccessTokenProvider } from "../auth/types";

export interface IGoogleDriveService {
  uploadImage(input: GoogleDriveUploadImageRequest): Promise<GoogleDriveFile>;
  downloadFile(fileId: string): Promise<GoogleDriveDownload>;
  makeFileReadableByLink(fileId: string): Promise<void>;
  checkConnection(): Promise<void>;
}

export interface GoogleDriveConfig {
  folderId: string;
  makeFilesReadableByLink: boolean;
  auth: IGoogleAccessTokenProvider;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
}

export interface GoogleDriveUploadImageRequest {
  fileName: string;
  contentType: string;
  bytes: Buffer;
}

export interface GoogleDriveDownload {
  bytes: Buffer;
  contentType: string;
}
