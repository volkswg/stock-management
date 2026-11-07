import type { LineReplyMessage } from "@/shared/types/line-protocol";
export type { LineQuickReply, LineReplyMessage, MessageQuickReplyAction, LineWebhookPayload, LineEvent } from "@/shared/types/line-protocol";

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
