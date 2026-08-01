import type {
  LineQuickReply,
  LineReplyMessage,
  MessageQuickReplyAction,
} from "../types";

export const createTextReplyMessage = ({
  text,
  quickReply,
}: {
  text: string;
  quickReply?: LineQuickReply;
}): LineReplyMessage => {
  return {
    type: "text",
    text,
    quickReply,
  };
};

export const createMessageQuickReply = (
  actions: MessageQuickReplyAction[],
): LineQuickReply | undefined => {
  const items = actions.map((action) => ({
    type: "action" as const,
    action: {
      type: "message" as const,
      label: action.label,
      text: action.text,
    },
  }));

  return items.length > 0 ? { items } : undefined;
};
