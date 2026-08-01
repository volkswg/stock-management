import { GOOGLE_TOKEN_URL } from "./const";
import type { IGoogleAccessTokenProvider } from "./types";
import { GoogleAccessTokenProvider } from "./GoogleAccessTokenProvider";
import { signJwt } from "../utils/jwt";

export type GoogleServiceAccountAuthConfig = {
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  scopes: string[];
};

export class GoogleServiceAccountAuth
  extends GoogleAccessTokenProvider
  implements IGoogleAccessTokenProvider
{
  constructor(private readonly config: GoogleServiceAccountAuthConfig) {
    super();

    if (!config.serviceAccountEmail.trim()) {
      throw new Error("Google service account email is required.");
    }

    if (!config.serviceAccountPrivateKey.trim()) {
      throw new Error("Google service account private key is required.");
    }

    if (config.scopes.length === 0) {
      throw new Error("At least one Google OAuth scope is required.");
    }
  }

  async getAccessToken(): Promise<string> {
    const cachedAccessToken = this.getCachedAccessToken();
    if (cachedAccessToken) return cachedAccessToken;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const assertion = signJwt(
      {
        alg: "RS256",
        typ: "JWT",
      },
      {
        iss: this.config.serviceAccountEmail,
        scope: this.config.scopes.join(" "),
        aud: GOOGLE_TOKEN_URL,
        exp: nowSeconds + 3600,
        iat: nowSeconds,
      },
      this.config.serviceAccountPrivateKey,
    );

    const response = await this.exchangeAccessToken(
      new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google OAuth token request failed: ${response.status} ${errorBody}`,
      );
    }

    const payload = await readAccessTokenPayload(response);
    return this.setAccessToken(payload.accessToken, payload.expiresIn);
  }
}

async function readAccessTokenPayload(
  response: Response,
): Promise<{ accessToken: string; expiresIn: number }> {
  const payload = (await response.json()) as unknown;

  if (!isRecord(payload)) {
    throw new Error("Google OAuth token response must be an object.");
  }

  const accessToken = payload.access_token;
  const expiresIn = payload.expires_in;

  if (typeof accessToken !== "string" || typeof expiresIn !== "number") {
    throw new Error("Google OAuth token response is missing access token data.");
  }

  return { accessToken, expiresIn };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
