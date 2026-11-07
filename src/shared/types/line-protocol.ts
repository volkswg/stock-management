export enum LineMessageType {
    Text = "text",
    Image = "image",
    Video = "video",
    Audio = "audio",
    File = "file",
    Location = "location",
    Sticker = "sticker"
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
export type LineReplyMessage = {
    type: "text";
    text: string;
    quickReply?: LineQuickReply;
} | {
    type: "template";
    altText: string;
    template: {
        type: "buttons";
        title?: string;
        text: string;
        actions: Array<{
            type: "message" | "uri";
            label: string;
            text?: string;
            uri?: string;
        }>;
    } | {
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
        type: LineMessageType;
        text?: string;
        contentProvider?: {
            type: string;
            originalContentUrl?: string;
            previewImageUrl?: string;
        };
    };
};
