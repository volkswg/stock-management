import { createSortableId } from "@/services/utils/createSortableId";
import type { IGoogleDriveService } from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { LineMessageType, type LineEvent } from "@/externals/line";
import type { ILineBotService, LineReplyMessage } from "@/externals/line/types";
import { findLatestUserState } from "@/services/user-states";
import { isActiveOrderCreateState, UserStateFlowName } from "@/services/orders";
import {
  isMovementStartCommand,
  type MovementEventClassification,
} from "@/features/backend/line/utils";
import {
  movementItems, resumeLegacyMovement, saveMaster,
  saveMovementState, type MovementState,
} from "@/services/movements/state";
import { MovementStartCommandEnum } from "@/features/backend/line/enum";
import { parseQuantity } from "./utils";

const START_CHOICES = [["Create New", "create:new-movement"], ["Resume Unfinished", "resume:movement"]];

// Routing has already resolved the movement session for this event.
export async function handleMovementEvent({
  event, session, sheets, drive, line, publicBaseUrl,
}: {
  event: MovementEventClassification["event"];
  session: MovementEventClassification["session"];
  sheets: IGoogleSheetsService;
  drive: () => IGoogleDriveService | undefined;
  line: ILineBotService;
  publicBaseUrl: string;
}): Promise<void> {
  const userId = event.source.userId;
  const text = event.message.text?.trim() || "";
  const command = text.toLowerCase();
  const eventId = event.webhookEventId || event.message.id;
  const { state, processed } = session;

  if (state && processed) {
    if (state.step === "complete") {
      await summary(line, event, sheets, state, publicBaseUrl);
    } else {
      // Repair the master if the current state saved but its master sync failed.
      await saveMaster(sheets, state);
      await prompt(line, event, state);
    }
    return;
  }

  if (isMovementStartCommand(command)) {
    const orderState = await findLatestUserState({ googleSheetsService: sheets, userId, flowname: UserStateFlowName.OrderCreate });
    if (orderState && isActiveOrderCreateState(orderState.state)) {
      await reply(line, event, "Please complete your pending order before creating a movement.");
      return;
    }
    if (command === MovementStartCommandEnum.CreateMovement) {
      await reply(line, event, "📦 Stock movement\nMove products from Home to a shop.\n\nTap Create New to start, or Resume Unfinished to continue.", START_CHOICES);
      return;
    }
    if (command === MovementStartCommandEnum.ResumeMovement) {
      const resumed = state && state.step !== "complete" ? state : await resumeLegacyMovement(sheets, userId);
      if (!resumed) {
        await reply(line, event, "No unfinished movement was found.", START_CHOICES.slice(0, 1));
      } else {
        await saveMovementState(sheets, { ...resumed, lastEventId: eventId });
        await prompt(line, event, resumed, `↩️ Movement resumed\nRef: ${resumed.masterId}\n\n`);
      }
      return;
    }
    const masterId = `MOVE-${createSortableId()}`;
    const next: MovementState = {
      masterId, itemId: `MOVED-${createSortableId()}`, userId, step: "shop",
      startedAt: new Date(event.timestamp || Date.now()).toISOString(), shop: "",
      quantity: "", remark: "", imageUrl: "", lastEventId: eventId,
    };
    await saveMovementState(sheets, next);
    await saveMaster(sheets, next);
    await prompt(line, event, next, `📦 New movement started\nRef: ${masterId}\n\n`);
    return;
  }

  if (!state || state.step === "complete") {
    return;
  }
  if (command === "create:order" || command === "create:purchase-order") {
    await prompt(line, event, state, "Please complete your movement before starting an order.\n");
    return;
  }

  if (event.message.type === LineMessageType.Image) {
    if (state.step !== "product_image") {
      await prompt(line, event, state);
      return;
    }
    await saveImage({ state, event, eventId, sheets, drive: drive(), line });
    return;
  }

  let next: MovementState = { ...state, lastEventId: eventId };
  if (state.step === "shop") {
    const shop = text.toUpperCase();
    if (shop !== "NJ" && shop !== "YY") {
      await prompt(line, event, state);
      return;
    }
    next = { ...next, shop, step: "quantity" };
  } else if (state.step === "quantity" || state.step === "close_bag") {
    if (state.step === "close_bag" && command === "close bag") {
      next.step = "bag_closed";
    } else {
      const parsed = parseQuantity(text);
      if (!parsed) {
        await prompt(line, event, state, "⚠️ Quantity not accepted. Send a number greater than 0.\n\n");
        return;
      }
      next = { ...next, ...parsed, step: "product_image", imageUrl: "" };
    }
  } else if (state.step === "bag_closed" && command === "another shop") {
    next = { ...next, step: "shop", itemId: `MOVED-${createSortableId()}`, shop: "", quantity: "", remark: "", imageUrl: "" };
  } else if (state.step === "bag_closed" && ["summary", "movement summary"].includes(command)) {
    await saveMaster(sheets, state, true);
    next.step = "complete";
    await saveMovementState(sheets, next);
    await summary(line, event, sheets, next, publicBaseUrl);
    return;
  } else {
    await prompt(line, event, state);
    return;
  }
  await saveMovementState(sheets, next);
  await prompt(line, event, next);
}

async function saveImage({ state, event, eventId, sheets, drive, line }: {
  state: MovementState; event: LineEvent; eventId: string;
  sheets: IGoogleSheetsService; drive: IGoogleDriveService | undefined; line: ILineBotService;
}): Promise<void> {
  // A stable item ID makes a retry after an uncertain Sheets response idempotent.
  const existing = (await movementItems(sheets, state.masterId)).find((row) => row[0] === state.itemId);
  let imageUrl = state.imageUrl;
  if (!existing && !imageUrl) {
    if (!drive) {
      await reply(line, event, `⚠️ Photo upload is unavailable\nShop: ${state.shop} | Quantity: ${state.quantity}\nYour progress is saved, but this item is not saved yet.\n\nAsk an administrator to configure Google Drive, then resend the photo.`);
      return;
    }
    try {
      const image = await line.downloadMessageContent(event.message!.id);
      const extension = image.contentType === "image/png" ? ".png" : image.contentType === "image/webp" ? ".webp" : ".jpg";
      const file = await drive.uploadImage({ fileName: `${state.itemId}${extension}`, contentType: image.contentType, bytes: image.bytes });
      if (!file.webViewLink?.trim()) throw new Error("Google Drive returned no image URL.");
      imageUrl = file.webViewLink;
    } catch {
      await reply(line, event, `⚠️ Photo upload failed\nShop: ${state.shop} | Quantity: ${state.quantity}\nThis item is not saved yet. Your entered quantity is kept.\n\n➡️ Send the product photo again to save this item.`);
      return;
    }
    // Persist the upload URL before writing the item so a retry can reuse it.
    await saveMovementState(sheets, { ...state, imageUrl });
  }
  if (!existing) {
    const now = new Date(event.timestamp || Date.now()).toISOString();
    await sheets.movementDetails.appendRows("A:N", [[
      state.itemId, state.masterId, state.shop, state.quantity, state.remark,
      "Home", state.shop, imageUrl, "", "created", now, now, false, false,
    ]]);
  }
  await saveMaster(sheets, state);
  const next: MovementState = {
    ...state, itemId: `MOVED-${createSortableId()}`, step: "close_bag",
    quantity: "", remark: "", imageUrl: "", lastEventId: eventId,
  };
  await saveMovementState(sheets, next);
  await prompt(line, event, next, `✅ Item saved\nRoute: Home → ${state.shop}\nQuantity: ${state.quantity}\nPhoto: saved${state.remark ? `\nBreakdown / note:\n${state.remark}` : ""}\n\n`);
}

async function summary(line: ILineBotService, event: LineEvent, sheets: IGoogleSheetsService, state: MovementState, publicBaseUrl: string): Promise<void> {
  const rows = await movementItems(sheets, state.masterId);
  const quantities = new Map<string, number>();
  for (const row of rows) {
    const shop = String(row[2]);
    quantities.set(shop, (quantities.get(shop) || 0) + Number(row[3] || 0));
  }
  const totalQuantity = Array.from(quantities.values()).reduce((total, quantity) => total + quantity, 0);
  const shopTotals = Array.from(quantities, ([shop, quantity]) => `• Home → ${shop}: ${quantity}`).join("\n");
  const text = `✅ Movement completed\nRef: ${state.masterId}\n\n${shopTotals || "No items saved."}\n\nItems saved: ${rows.length}\nTotal quantity: ${totalQuantity}`;
  if (!publicBaseUrl) {
    await reply(line, event, text);
    return;
  }
  await line.sendReply(event.replyToken, [{ type: "text", text }, {
    type: "template", altText: `Movement summary ${state.masterId}`,
    template: { type: "buttons", title: "Movement completed", text: "View saved items, quantities and product photos.",
      actions: [{ type: "uri", label: "Open detail", uri: `${publicBaseUrl.replace(/\/$/, "")}/movements/${encodeURIComponent(state.masterId)}` }],
    },
  }]);
}

async function prompt(line: ILineBotService, event: LineEvent, state: MovementState, prefix = ""): Promise<void> {
  switch (state.step) {
    case "shop": return reply(line, event, prefix + "📍 Choose destination shop\nFrom: Home\n\n➡️ Tap NJ or YY.", [["NJ", "NJ"], ["YY", "YY"]]);
    case "quantity": return reply(line, event, prefix + `📍 Home → ${state.shop}\n\n➡️ Send the quantity for one product photo.\nExample: 12\n\nFor a breakdown, put each quantity on a new line:\nขาว 5\nดำ 5\nThe quantities will be added together.`);
    case "product_image": return reply(line, event, prefix + `📍 Home → ${state.shop}\nQuantity entered: ${state.quantity}${state.remark ? `\nBreakdown / note:\n${state.remark}` : ""}\n\n⏳ Item not saved yet.\n➡️ Send a product photo to save this item.`);
    case "close_bag": return reply(line, event, prefix + `Next for ${state.shop}:\n• Add another item: send its quantity, then its photo.\n• Finished this bag: tap Close Bag.`, [["Close Bag", "close bag"]]);
    case "bag_closed": return reply(line, event, prefix + `✅ Bag closed for ${state.shop}\n\n➡️ Another Shop: choose a shop and add more items.\n➡️ Summary: finish this movement and view totals.`, [["Another Shop", "another shop"], ["Summary", "summary"]]);
    case "complete": return reply(line, event, prefix + "✅ Movement completed\nAll saved items are included.\n\n➡️ Tap Create New to start another movement.", START_CHOICES);
  }
}

async function reply(line: ILineBotService, event: LineEvent, text: string, choices: string[][] = []): Promise<void> {
  const message: LineReplyMessage = { type: "text", text };
  if (choices.length) message.quickReply = { items: choices.map(([label, text]) => ({ type: "action", action: { type: "message", label, text } })) };
  await line.sendReply(event.replyToken, [message]);
}

