import { GoogleAccessTokenProvider } from "./GoogleAccessTokenProvider";
import type { IGoogleAccessTokenProvider } from "./types";

export type GoogleOAuthRefreshTokenAuthConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export class GoogleOAuthRefreshTokenAuth
  extends GoogleAccessTokenProvider
  implements IGoogleAccessTokenProvider
{
  constructor(private readonly config: GoogleOAuthRefreshTokenAuthConfig) {
    super();
  }

  async getAccessToken(): Promise<string> {
    const cachedAccessToken = this.getCachedAccessToken();
    if (cachedAccessToken) return cachedAccessToken;

    const response = await this.exchangeAccessToken(
      new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: "refresh_token",
      }),
    );

    if (!response.ok) {
      const errorBody = await response.text();
      const googleError = parseGoogleOAuthError(errorBody);
      throw new Error(
        [
          `Google OAuth refresh failed: ${response.status}`,
          googleError
            ? `${googleError.error}: ${googleError.errorDescription}`
            : errorBody,
        ].join(" "),
      );
    }

    const payload = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    return this.setAccessToken(payload.access_token, payload.expires_in);
  }
}

function parseGoogleOAuthError(
  value: string,
): { error: string; errorDescription: string } | null {
  try {
    const payload = JSON.parse(value) as {
      error?: string;
      error_description?: string;
    };

    if (!payload.error) return null;

    return {
      error: payload.error,
      errorDescription: payload.error_description || "No description",
    };
  } catch {
    return null;
  }
}
