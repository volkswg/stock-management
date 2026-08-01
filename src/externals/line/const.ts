export const LINE_API_BASE_URL = "https://api.line.me/v2/bot";

export const LINE_REPLY_MESSAGE_URL = `${LINE_API_BASE_URL}/message/reply`;

export const LINE_PUSH_MESSAGE_URL = `${LINE_API_BASE_URL}/message/push`;

export const LINE_RICH_MENU_IMAGE_BASE_URL = `${LINE_API_BASE_URL}/richmenu`;

export const LINE_RICH_MENU_IMAGE_UPLOAD_URL = (richMenuId: string) =>
  `https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(
    richMenuId,
  )}/content`;

export const LINE_DOWNLOAD_MESSAGE_CONTENT_URL = (messageId: string) =>
  `https://api-data.line.me/v2/bot/message/${encodeURIComponent(
    messageId,
  )}/content`;
