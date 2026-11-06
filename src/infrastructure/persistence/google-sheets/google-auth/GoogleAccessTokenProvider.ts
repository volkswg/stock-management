import { GOOGLE_TOKEN_URL } from "./const";
import type {
  GoogleAccessToken,
  IGoogleAccessTokenProvider,
} from "./types";

export abstract class GoogleAccessTokenProvider
  implements IGoogleAccessTokenProvider
{
  protected accessToken: GoogleAccessToken | null = null;

  abstract getAccessToken(): Promise<string>;

  protected getCachedAccessToken(): string | null {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.accessToken;
    }

    return null;
  }

  protected setAccessToken(
    accessToken: string,
    expiresInSeconds: number,
  ): string {
    this.accessToken = {
      accessToken,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    };

    return this.accessToken.accessToken;
  }

  protected async exchangeAccessToken(body: URLSearchParams): Promise<Response> {
    return fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  }
}
