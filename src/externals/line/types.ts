export interface ILineBotService {
  sendPush(userId: string, messages: LineReplyMessage[]): Promise<void>;
  sendReply(
    replyToken: string | undefined,
    messages: LineReplyMessage[],
  ): Promise<void>;
  verifyLineSignature(
    rawBody: Buffer,
    signature: string | string[] | undefined,
  ): boolean;
  downloadMessageContent(messageId: string): Promise<DownloadedMessageContent>;
  createRichMenu(richMenu: RichMenuRequest): Promise<string>;
  uploadRichMenuImage(input: {
    richMenuId: string;
    image: Buffer;
    contentType: string;
  }): Promise<void>;
  setDefaultRichMenu(richMenuId: string): Promise<void>;
  createRichMenuAlias(input: {
    richMenuAliasId: string;
    richMenuId: string;
  }): Promise<void>;
  updateRichMenuAlias(input: {
    richMenuAliasId: string;
    richMenuId: string;
  }): Promise<void>;
  upsertRichMenuAlias(input: {
    richMenuAliasId: string;
    richMenuId: string;
  }): Promise<void>;
}

export interface LineQuickReply {
  items: Array<{
    type: "action";
    action: {
      type: "message";
      label: string;
      text: string;
    };
  }>;
}

export type LineReplyMessage =
  | {
      type: "text";
      text: string;
      quickReply?: LineQuickReply;
    }
  | {
      type: "template";
      altText: string;
      template:
        | {
            type: "buttons";
            title?: string;
            text: string;
            actions: Array<{
              type: "message" | "uri";
              label: string;
              text?: string;
              uri?: string;
            }>;
          }
        | {
            type: "carousel";
            columns: Array<{
              title: string;
              text: string;
              actions: Array<{
                type: "message" | "uri";
                label: string;
                text?: string;
                uri?: string;
              }>;
            }>;
          };
    };

export interface MessageQuickReplyAction {
  label: string;
  text: string;
}

export interface DownloadedMessageContent {
  contentType: string;
  bytes: Buffer;
}

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

export type LineWebhookPayload = {
  events?: LineEvent[];
};

export type LineEvent = {
  type: string;
  replyToken?: string;
  timestamp?: number;
  webhookEventId?: string;
  source?: {
    userId?: string;
    groupId?: string;
  };
  message?: {
    id: string;
    type: string;
    text?: string;
    contentProvider?: {
      type: string;
      originalContentUrl?: string;
      previewImageUrl?: string;
    };
  };
};
