import type { AppConfig } from "../../../config";
import { GoogleOAuthRefreshTokenAuth } from "../auth/GoogleOAuthRefreshTokenAuth";
import { GoogleServiceAccountAuth } from "../auth/GoogleServiceAccountAuth";
import type { IGoogleAccessTokenProvider } from "../auth/types";
import { GOOGLE_DRIVE_SCOPE } from "./const";
import { GoogleDriveService } from "./GoogleDriveService";

export function createGoogleDriveServiceFromConfig(
  config: AppConfig,
): GoogleDriveService | undefined {
  if (!config.googleDrive.folderId) {
    return undefined;
  }

  const auth = createGoogleDriveAuthFromConfig(config);
  if (!auth) return undefined;

  return new GoogleDriveService({
    folderId: config.googleDrive.folderId,
    makeFilesReadableByLink: config.googleDrive.makeFilesReadableByLink,
    auth,
  });
}

function createGoogleDriveAuthFromConfig(
  config: AppConfig,
): IGoogleAccessTokenProvider | undefined {
  if (
    config.googleOAuth.clientId &&
    config.googleOAuth.clientSecret &&
    config.googleOAuth.refreshToken
  ) {
    return new GoogleOAuthRefreshTokenAuth({
      clientId: config.googleOAuth.clientId,
      clientSecret: config.googleOAuth.clientSecret,
      refreshToken: config.googleOAuth.refreshToken,
    });
  }

  if (
    config.googleService.accountEmail &&
    config.googleService.accountPrivateKey
  ) {
    return new GoogleServiceAccountAuth({
      serviceAccountEmail: config.googleService.accountEmail,
      serviceAccountPrivateKey: config.googleService.accountPrivateKey,
      scopes: [GOOGLE_DRIVE_SCOPE],
    });
  }

  return undefined;
}
