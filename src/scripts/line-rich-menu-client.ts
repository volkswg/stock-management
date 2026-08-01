const LINE_API_BASE_URL = "https://api.line.me/v2/bot";
const LINE_RICH_MENU_IMAGE_BASE_URL = `${LINE_API_BASE_URL}/richmenu`;
const LINE_RICH_MENU_IMAGE_UPLOAD_URL = (richMenuId: string) =>
  `https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(
    richMenuId,
  )}/content`;

export interface RichMenuRequest {
  size: {
    width: number;
    height: number;
  };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: Array<{
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    action:
      | {
          type: "message";
          label: string;
          text: string;
        }
      | {
          type: "uri";
          label: string;
          uri: string;
        }
      | {
          type: "richmenuswitch";
          label: string;
          richMenuAliasId: string;
          data: string;
        };
  }>;
}

export class LineRichMenuClient {
  private readonly channelAccessToken: string;

  constructor(channelAccessToken: string) {
    this.channelAccessToken = channelAccessToken;
  }

  async createRichMenu(richMenu: RichMenuRequest): Promise<string> {
    const response = await fetch(LINE_RICH_MENU_IMAGE_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.channelAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(richMenu),
    });

    await verifyLineApiResponseSucceeded(
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

    await verifyLineApiResponseSucceeded(
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

    await verifyLineApiResponseSucceeded(
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

    await verifyLineApiResponseSucceeded(
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

    await verifyLineApiResponseSucceeded(
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
}

async function verifyLineApiResponseSucceeded(
  response: Response,
  failureMessage: string,
): Promise<void> {
  if (response.ok) return;

  const body = await response.text();
  throw new Error(`${failureMessage}: ${response.status} ${body}`);
}

function isLineNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(": 404 ");
}
