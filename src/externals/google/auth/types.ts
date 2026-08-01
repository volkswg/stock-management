export type GoogleAccessToken = {
  accessToken: string;
  expiresAt: number;
};

export interface IGoogleAccessTokenProvider {
  getAccessToken(): Promise<string>;
}
