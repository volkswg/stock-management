import { createHash } from "node:crypto";
import type { IGoogleDriveService } from "@/externals/google/drive";
import type { IGoogleSheetsService } from "@/externals/google/sheet";
import { LineMessageType, type LineEvent } from "@/externals/line";
import type { ILineBotService, LineReplyMessage } from "@/externals/line/types";
import { findLatestUserState } from "@/services/user-states";
import { isActiveOrderCreateState, UserStateFlowName } from "@/services/orders";
import {
  movementItems, readMovementSession, resumeLegacyMovement, saveMaster,
  saveMovementState, type MovementState,
} from "./state";

const START_COMMANDS = ["create:movement", "create:new-movement", "resume:movement"];
const START_CHOICES = [["Create New", "create:new-movement"], ["Resume Unfinished", "resume:movement"]];

// Called before legacy routing. Every message resolves its state from Sheets.
export async function handleMovementEvent({
  event, sheets, drive, line, publicBaseUrl,
}: {
  event: LineEvent;
  sheets: IGoogleSheetsService;
  drive: () => IGoogleDriveService | undefined;
  line: ILineBotService;
  publicBaseUrl: string;
}): Promise<boolean> {
  if (event.type !== "message" || !event.message || !event.source?.userId) return false;
  if (event.message.type !== LineMessageType.Text && event.message.type !== LineMessageType.Image) return false;
  const userId = event.source.userId;
  const text = event.message.text?.trim() || "";
  const command = text.toLowerCase();
  const eventId = event.webhookEventId || event.message.id;
  const { state, processed } = await readMovementSession(sheets, userId, eventId);

  if (state && processed) {
    if (state.step === "complete") {
      await summary(line, event, sheets, state, publicBaseUrl);
    } else {
      // Repair the master if a previous checkpoint succeeded but its sync failed.
      await saveMaster(sheets, state);
      await prompt(line, event, state);
    }
    return true;
  }

  if (START_COMMANDS.includes(command)) {
    const orderState = await findLatestUserState({ googleSheetsService: sheets, userId, flowname: UserStateFlowName.OrderCreate });
    if (orderState && isActiveOrderCreateState(orderState.state)) {
      await reply(line, event, "Please complete your pending order before creating a movement.");
      return true;
    }
    if (command === "create:movement") {
      await reply(line, event, "Create a new movement or resume your unfinished movement?", START_CHOICES);
      return true;
    }
    if (command === "resume:movement") {
      const resumed = state && state.step !== "complete" ? state : await resumeLegacyMovement(sheets, userId);
      if (!resumed) {
        await reply(line, event, "No unfinished movement was found.", START_CHOICES.slice(0, 1));
      } else {
        await saveMovementState(sheets, { ...resumed, lastEventId: eventId });
        await prompt(line, event, resumed, `Resumed movement ${resumed.masterId}.\n`);
      }
      return true;
    }
    const masterId = `MOVE-${eventKey(eventId)}`;
    const next: MovementState = {
      masterId, itemId: `MOVED-${eventKey(eventId)}`, userId, step: "shop",
      startedAt: new Date(event.timestamp || Date.now()).toISOString(), shop: "",
      quantity: "", remark: "", imageUrl: "", lastEventId: eventId,
    };
    await saveMovementState(sheets, next);
    await saveMaster(sheets, next);
    await prompt(line, event, next, `Movement ${masterId} created.\n`);
    return true;
  }

  if (!state || state.step === "complete") {
    return false;
  }
  if (command === "create:order" || command === "create:purchase-order") {
    await prompt(line, event, state, "Please complete your movement before starting an order.\n");
    return true;
  }

  if (event.message.type === LineMessageType.Image) {
    if (state.step !== "product_image") {
      await prompt(line, event, state);
      return true;
    }
    await saveImage({ state, event, eventId, sheets, drive: drive(), line });
    return true;
  }

  let next: MovementState = { ...state, lastEventId: eventId };
  if (state.step === "shop") {
    const shop = text.toUpperCase();
    if (shop !== "NJ" && shop !== "YY") {
      await prompt(line, event, state);
      return true;
    }
    next = { ...next, shop, step: "quantity" };
  } else if (state.step === "quantity" || state.step === "close_bag") {
    if (state.step === "close_bag" && command === "close bag") {
      next.step = "bag_closed";
    } else {
      const parsed = parseQuantity(text);
      if (!parsed) {
        await prompt(line, event, state, "Send a quantity greater than 0 (for example: 12 or ขาว 5 / ดำ 5).\n");
        return true;
      }
      next = { ...next, ...parsed, step: "product_image", imageUrl: "" };
    }
  } else if (state.step === "bag_closed" && command === "another shop") {
    next = { ...next, step: "shop", itemId: `MOVED-${eventKey(eventId)}`, shop: "", quantity: "", remark: "", imageUrl: "" };
  } else if (state.step === "bag_closed" && ["summary", "movement summary"].includes(command)) {
    await saveMaster(sheets, state, true);
    next.step = "complete";
    await saveMovementState(sheets, next);
    await summary(line, event, sheets, next, publicBaseUrl);
    return true;
  } else {
    await prompt(line, event, state);
    return true;
  }
  await saveMovementState(sheets, next);
  await prompt(line, event, next);
  return true;
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
      await reply(line, event, "Google Drive is not configured. Your movement is saved; please try the image again after configuration.");
      return;
    }
    try {
      const image = await line.downloadMessageContent(event.message!.id);
      const extension = image.contentType === "image/png" ? ".png" : image.contentType === "image/webp" ? ".webp" : ".jpg";
      const file = await drive.uploadImage({ fileName: `${state.itemId}${extension}`, contentType: image.contentType, bytes: image.bytes });
      if (!file.webViewLink?.trim()) throw new Error("Google Drive returned no image URL.");
      imageUrl = file.webViewLink;
    } catch {
      await reply(line, event, "Product image upload failed. No movement item was saved. Please send the image again.");
      return;
    }
    // Persist the upload URL before writing the item so a Sheets retry can reuse it.
    await saveMovementState(sheets, { ...state, imageUrl });
  }
  if (!existing) {
    const now = new Date(event.timestamp || Date.now()).toISOString();
    await sheets.movementDetails.appendRows("A:M", [[
      state.itemId, state.masterId, state.shop, state.quantity, state.remark,
      "Home", state.shop, imageUrl, "", "created", now, now, false,
    ]]);
  }
  await saveMaster(sheets, state);
  const next: MovementState = {
    ...state, itemId: `MOVED-${eventKey(eventId)}-NEXT`, step: "close_bag",
    quantity: "", remark: "", imageUrl: "", lastEventId: eventId,
  };
  await saveMovementState(sheets, next);
  await prompt(line, event, next, `Product image saved for ${state.shop}. Quantity: ${state.quantity}.\n`);
}

async function summary(line: ILineBotService, event: LineEvent, sheets: IGoogleSheetsService, state: MovementState, publicBaseUrl: string): Promise<void> {
  const rows = await movementItems(sheets, state.masterId);
  const quantities = new Map<string, number>();
  for (const row of rows) {
    const shop = String(row[2]);
    quantities.set(shop, (quantities.get(shop) || 0) + Number(row[3] || 0));
  }
  const text = Array.from(quantities, ([shop, quantity]) => `${shop}: ${quantity}`).join(", ");
  if (!publicBaseUrl) {
    await reply(line, event, `Movement ${state.masterId} completed.\nItems: ${rows.length}\n${text}`);
    return;
  }
  await line.sendReply(event.replyToken, [{
    type: "template", altText: `Movement summary ${state.masterId}`,
    template: { type: "buttons", title: "Movement completed", text: (text || "No items saved").slice(0, 60),
      actions: [{ type: "uri", label: "Open detail", uri: `${publicBaseUrl.replace(/\/$/, "")}/movements/${encodeURIComponent(state.masterId)}` }],
    },
  }]);
}

async function prompt(line: ILineBotService, event: LineEvent, state: MovementState, prefix = ""): Promise<void> {
  switch (state.step) {
    case "shop": return reply(line, event, prefix + "Please choose shop.", [["NJ", "NJ"], ["YY", "YY"]]);
    case "quantity": return reply(line, event, prefix + "Please send quantity.");
    case "product_image": return reply(line, event, prefix + `Quantity: ${state.quantity}. Please upload product image.`);
    case "close_bag": return reply(line, event, prefix + `Send another quantity for ${state.shop}, or tap Close Bag.`, [["Close Bag", "close bag"]]);
    case "bag_closed": return reply(line, event, prefix + "Choose another shop or view summary.", [["Another Shop", "another shop"], ["Summary", "summary"]]);
    case "complete": return reply(line, event, prefix + "Movement completed.", START_CHOICES);
  }
}

async function reply(line: ILineBotService, event: LineEvent, text: string, choices: string[][] = []): Promise<void> {
  const message: LineReplyMessage = { type: "text", text };
  if (choices.length) message.quickReply = { items: choices.map(([label, text]) => ({ type: "action", action: { type: "message", label, text } })) };
  await line.sendReply(event.replyToken, [message]);
}

function parseQuantity(text: string): { quantity: string; remark: string } | undefined {
  const total = text.split(/\r?\n/)
    .map((line) => line.match(/\d[\d,]*(?:\.\d+)?/g)?.at(-1))
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return undefined;
  return { quantity: String(total), remark: /^\d[\d,]*(?:\.\d+)?$/.test(text) ? "" : text };
}

function eventKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24).toUpperCase();
}
