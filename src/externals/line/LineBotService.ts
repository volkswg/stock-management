import crypto from "node:crypto";
import {
  LINE_API_BASE_URL,
  LINE_DOWNLOAD_MESSAGE_CONTENT_URL,
  LINE_PUSH_MESSAGE_URL,
  LINE_REPLY_MESSAGE_URL,
  LINE_RICH_MENU_IMAGE_BASE_URL,
  LINE_RICH_MENU_IMAGE_UPLOAD_URL,
} from "./const";
import type {
  DownloadedMessageContent,
  ILineBotService,
  LineReplyMessage,
  RichMenuRequest,
} from "./types";

export class LineBotService implements ILineBotService {
  private readonly channelAccessToken: string;
  private readonly channelSecret: string;

  constructor(channelAccessToken: string, channelSecret: string) {
    this.channelAccessToken = channelAccessToken;
    this.channelSecret = channelSecret;
  }

  verifyLineSignature(
    rawBody: Buffer,
    signature: string | string[] | undefined,
  ): boolean {
    if (!signature || !this.channelSecret) return false;
    const signatureValue = Array.isArray(signature) ? signature[0] : signature;

    const expected = crypto
      .createHmac("sha256", this.channelSecret)
      .update(rawBody)
      .digest("base64");

    const signatureBuffer = Buffer.from(signatureValue);
    const expectedBuffer = Buffer.from(expected);

    if (signatureBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  }

  async sendPush(
    userId: string,
    messages: LineReplyMessage[],
  ): Promise<void> {
    if (!userId || !this.channelAccessToken) return;

    const response = await fetch(LINE_PUSH_MESSAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: userId, messages }),
    });

    await this.verifyLineApiResponseSucceeded(response, "LINE push failed");
  }

  async sendReply(
    replyToken: string | undefined,
    messages: LineReplyMessage[],
  ): Promise<void> {
    if (!replyToken || !this.channelAccessToken) return;

    const response = await fetch(LINE_REPLY_MESSAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ replyToken, messages }),
    });

    await this.verifyLineApiResponseSucceeded(response, "LINE reply failed");
  }

  async downloadMessageContent(
    messageId: string,
  ): Promise<DownloadedMessageContent> {
    const response = await fetch(LINE_DOWNLOAD_MESSAGE_CONTENT_URL(messageId), {
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
      },
    });

    await this.verifyLineApiResponseSucceeded(
      response,
      "LINE content download failed",
    );

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const bytes = Buffer.from(await response.arrayBuffer());

    return { contentType, bytes };
  }

  async createRichMenu(richMenu: RichMenuRequest): Promise<string> {
    const response = await fetch(`${LINE_RICH_MENU_IMAGE_BASE_URL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(richMenu),
    });

    await this.verifyLineApiResponseSucceeded(
      response,
      "LINE rich menu creation failed",
    );

    const payload = (await response.json()) as { richMenuId: string };
    return payload.richMenuId;
  }

  async uploadRichMenuImage({
    richMenuId,
    image,
    contentType,
  }: {
    richMenuId: string;
    image: Buffer;
    contentType: string;
  }): Promise<void> {
    const response = await fetch(LINE_RICH_MENU_IMAGE_UPLOAD_URL(richMenuId), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
        "Content-Type": contentType,
      },
      body: new Uint8Array(image),
    });

    await this.verifyLineApiResponseSucceeded(
      response,
      "LINE rich menu image upload failed",
    );
  }

  async setDefaultRichMenu(richMenuId: string): Promise<void> {
    const response = await fetch(
      `${LINE_API_BASE_URL}/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.channelAccessToken}`,
        },
      },
    );

    await this.verifyLineApiResponseSucceeded(
      response,
      "LINE default rich menu setup failed",
    );
  }

  async createRichMenuAlias({
    richMenuAliasId,
    richMenuId,
  }: {
    richMenuAliasId: string;
    richMenuId: string;
  }): Promise<void> {
    const response = await fetch(`${LINE_API_BASE_URL}/richmenu/alias`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ richMenuAliasId, richMenuId }),
    });

    await this.verifyLineApiResponseSucceeded(
      response,
      "LINE rich menu alias creation failed",
    );
  }

  async updateRichMenuAlias({
    richMenuAliasId,
    richMenuId,
  }: {
    richMenuAliasId: string;
    richMenuId: string;
  }): Promise<void> {
    const response = await fetch(
      `${LINE_API_BASE_URL}/richmenu/alias/${encodeURIComponent(
        richMenuAliasId,
      )}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.channelAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ richMenuId }),
      },
    );

    await this.verifyLineApiResponseSucceeded(
      response,
      "LINE rich menu alias update failed",
    );
  }

  async upsertRichMenuAlias({
    richMenuAliasId,
    richMenuId,
  }: {
    richMenuAliasId: string;
    richMenuId: string;
  }): Promise<void> {
    try {
      await this.updateRichMenuAlias({
        richMenuAliasId,
        richMenuId,
      });
    } catch (error: unknown) {
      if (!isLineNotFoundError(error)) throw error;

      await this.createRichMenuAlias({
        richMenuAliasId,
        richMenuId,
      });
    }
  }

  private async verifyLineApiResponseSucceeded(
    response: Response,
    failureMessage: string,
  ): Promise<void> {
    if (response.ok) return;

    const body = await response.text();
    throw new Error(`${failureMessage}: ${response.status} ${body}`);
  }
}

function isLineNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(": 404 ");
}
