import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  LineRichMenuClient,
  type RichMenuRequest,
} from "./line-rich-menu-client.ts";

export const MAIN_RICH_MENU_ALIAS_ID = "main-menu";
export const PURCHASE_RICH_MENU_ALIAS_ID = "purchase-menu";
export const ORDER_RICH_MENU_ALIAS_ID = "order-menu";
export const MOVEMENT_RICH_MENU_ALIAS_ID = "movement-menu";

const RICH_MENU_WIDTH = 2500;
const RICH_MENU_HEIGHT = 843;
const MAIN_AREA_WIDTH = 833;
const SUBMENU_SIDE_AREA_WIDTH = 833;
const SUBMENU_MIDDLE_AREA_WIDTH = 834;
const MAX_RICH_MENU_IMAGE_BYTES = 1024 * 1024;

export function createMainRichMenu(): RichMenuRequest {
  return {
    size: {
      width: RICH_MENU_WIDTH,
      height: RICH_MENU_HEIGHT,
    },
    selected: true,
    name: "Main Menu",
    chatBarText: "Menu",
    areas: [
      {
        bounds: {
          x: 0,
          y: 0,
          width: MAIN_AREA_WIDTH,
          height: RICH_MENU_HEIGHT,
        },
        action: {
          type: "richmenuswitch",
          label: "Purchase",
          richMenuAliasId: PURCHASE_RICH_MENU_ALIAS_ID,
          data: "switch:purchase",
        },
      },
      {
        bounds: {
          x: MAIN_AREA_WIDTH,
          y: 0,
          width: SUBMENU_MIDDLE_AREA_WIDTH,
          height: RICH_MENU_HEIGHT,
        },
        action: {
          type: "richmenuswitch",
          label: "Order",
          richMenuAliasId: ORDER_RICH_MENU_ALIAS_ID,
          data: "switch:order",
        },
      },
      {
        bounds: {
          x: MAIN_AREA_WIDTH + SUBMENU_MIDDLE_AREA_WIDTH,
          y: 0,
          width: MAIN_AREA_WIDTH,
          height: RICH_MENU_HEIGHT,
        },
        action: {
          type: "richmenuswitch",
          label: "Movement",
          richMenuAliasId: MOVEMENT_RICH_MENU_ALIAS_ID,
          data: "switch:movement",
        },
      },
    ],
  };
}

export function createPurchaseRichMenu({
  publicBaseUrl,
}: {
  publicBaseUrl: string;
}): RichMenuRequest {
  return createThreeActionSubmenu({
    name: "Purchase Menu",
    chatBarText: "Purchase Menu",
    firstAction: {
      type: "message",
      label: "Create PO",
      text: "create:purchase-order",
    },
    secondAction: {
      type: "uri",
      label: "List PO",
      uri: buildPurchaseListUrl(publicBaseUrl),
    },
  });
}

export function createOrderRichMenu({
  publicBaseUrl,
}: {
  publicBaseUrl: string;
}): RichMenuRequest {
  return createThreeActionSubmenu({
    name: "Order Menu",
    chatBarText: "Order Menu",
    firstAction: {
      type: "message",
      label: "Create Order",
      text: "create:order",
    },
    secondAction: {
      type: "uri",
      label: "List Order",
      uri: buildOrderListUrl(publicBaseUrl),
    },
  });
}

export function createMovementRichMenu({
  publicBaseUrl,
}: {
  publicBaseUrl: string;
}): RichMenuRequest {
  return createThreeActionSubmenu({
    name: "Movement Menu",
    chatBarText: "Movement Menu",
    firstAction: {
      type: "message",
      label: "Create Movement",
      text: "create:movement",
    },
    secondAction: {
      type: "uri",
      label: "List Movement",
      uri: buildMovementListUrl(publicBaseUrl),
    },
  });
}

export async function setupSwitchableRichMenus({
  channelAccessToken,
  mainImagePath,
  purchaseImagePath,
  orderImagePath,
  movementImagePath,
  publicBaseUrl,
}: {
  channelAccessToken: string;
  mainImagePath: string;
  purchaseImagePath: string;
  orderImagePath: string;
  movementImagePath: string;
  publicBaseUrl: string;
}): Promise<{
  mainRichMenuId: string;
  purchaseRichMenuId: string;
  orderRichMenuId: string;
  movementRichMenuId: string;
}> {
  const lineRichMenuClient = new LineRichMenuClient(channelAccessToken);
  const mainRichMenuId = await createRichMenuWithImage({
    lineRichMenuClient,
    imagePath: mainImagePath,
    richMenu: createMainRichMenu(),
  });
  const purchaseRichMenuId = await createRichMenuWithImage({
    lineRichMenuClient,
    imagePath: purchaseImagePath,
    richMenu: createPurchaseRichMenu({ publicBaseUrl }),
  });
  const orderRichMenuId = await createRichMenuWithImage({
    lineRichMenuClient,
    imagePath: orderImagePath,
    richMenu: createOrderRichMenu({ publicBaseUrl }),
  });
  const movementRichMenuId = await createRichMenuWithImage({
    lineRichMenuClient,
    imagePath: movementImagePath,
    richMenu: createMovementRichMenu({ publicBaseUrl }),
  });

  await lineRichMenuClient.upsertRichMenuAlias({
    richMenuAliasId: MAIN_RICH_MENU_ALIAS_ID,
    richMenuId: mainRichMenuId,
  });
  await lineRichMenuClient.upsertRichMenuAlias({
    richMenuAliasId: PURCHASE_RICH_MENU_ALIAS_ID,
    richMenuId: purchaseRichMenuId,
  });
  await lineRichMenuClient.upsertRichMenuAlias({
    richMenuAliasId: ORDER_RICH_MENU_ALIAS_ID,
    richMenuId: orderRichMenuId,
  });
  await lineRichMenuClient.upsertRichMenuAlias({
    richMenuAliasId: MOVEMENT_RICH_MENU_ALIAS_ID,
    richMenuId: movementRichMenuId,
  });
  await lineRichMenuClient.setDefaultRichMenu(mainRichMenuId);

  return {
    mainRichMenuId,
    purchaseRichMenuId,
    orderRichMenuId,
    movementRichMenuId,
  };
}

function createThreeActionSubmenu({
  name,
  chatBarText,
  firstAction,
  secondAction,
}: {
  name: string;
  chatBarText: string;
  firstAction: RichMenuRequest["areas"][number]["action"];
  secondAction: RichMenuRequest["areas"][number]["action"];
}): RichMenuRequest {
  return {
    size: {
      width: RICH_MENU_WIDTH,
      height: RICH_MENU_HEIGHT,
    },
    selected: true,
    name,
    chatBarText,
    areas: [
      {
        bounds: {
          x: 0,
          y: 0,
          width: SUBMENU_SIDE_AREA_WIDTH,
          height: RICH_MENU_HEIGHT,
        },
        action: firstAction,
      },
      {
        bounds: {
          x: SUBMENU_SIDE_AREA_WIDTH,
          y: 0,
          width: SUBMENU_MIDDLE_AREA_WIDTH,
          height: RICH_MENU_HEIGHT,
        },
        action: secondAction,
      },
      {
        bounds: {
          x: SUBMENU_SIDE_AREA_WIDTH + SUBMENU_MIDDLE_AREA_WIDTH,
          y: 0,
          width: SUBMENU_SIDE_AREA_WIDTH,
          height: RICH_MENU_HEIGHT,
        },
        action: {
          type: "richmenuswitch",
          label: "Back",
          richMenuAliasId: MAIN_RICH_MENU_ALIAS_ID,
          data: "switch:main",
        },
      },
    ],
  };
}

function buildMovementListUrl(publicBaseUrl: string): string {
  return `${normalizePublicBaseUrl(publicBaseUrl)}/movements`;
}

function buildOrderListUrl(publicBaseUrl: string): string {
  return `${normalizePublicBaseUrl(publicBaseUrl)}/orders`;
}

function buildPurchaseListUrl(publicBaseUrl: string): string {
  return `${normalizePublicBaseUrl(publicBaseUrl)}/purchases`;
}

function normalizePublicBaseUrl(publicBaseUrl: string): string {
  return publicBaseUrl.replace(/\/$/, "");
}

async function createRichMenuWithImage({
  lineRichMenuClient,
  imagePath,
  richMenu,
}: {
  lineRichMenuClient: LineRichMenuClient;
  imagePath: string;
  richMenu: RichMenuRequest;
}): Promise<string> {
  const image = await readFile(imagePath);
  if (image.byteLength > MAX_RICH_MENU_IMAGE_BYTES) {
    throw new Error(
      `Rich menu image is too large: ${imagePath} is ${formatBytes(
        image.byteLength,
      )}. LINE rich menu images must be 1 MB or smaller.`,
    );
  }

  const richMenuId = await lineRichMenuClient.createRichMenu(richMenu);

  await lineRichMenuClient.uploadRichMenuImage({
    richMenuId,
    image,
    contentType: getImageContentType(imagePath),
  });

  return richMenuId;
}

function getImageContentType(imagePath: string): string {
  const extension = extname(imagePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";

  throw new Error("Rich menu image must be a .png, .jpg, or .jpeg file.");
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
