import fs from "node:fs";
import path from "node:path";
import { setupSwitchableRichMenus } from "./rich-menu.ts";

type RichMenuSetupConfig = {
  channelAccessToken: string;
  publicBaseUrl: string;
  images: RichMenuImageConfig;
};

type RichMenuImageConfig = {
  mainImagePath: string;
  purchaseImagePath: string;
  orderImagePath: string;
  movementImagePath: string;
};

async function main(): Promise<void> {
  const config = getRichMenuSetupConfig();

  if (!config.channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is required.");
  }

  if (!config.publicBaseUrl) {
    throw new Error("PUBLIC_BASE_URL is required for rich menu web links.");
  }

  const {
    mainRichMenuId,
    purchaseRichMenuId,
    orderRichMenuId,
    movementRichMenuId,
  } = await setupSwitchableRichMenus({
    channelAccessToken: config.channelAccessToken,
    mainImagePath: config.images.mainImagePath,
    purchaseImagePath: config.images.purchaseImagePath,
    orderImagePath: config.images.orderImagePath,
    movementImagePath: config.images.movementImagePath,
    publicBaseUrl: config.publicBaseUrl,
  });

  console.log(`Default main rich menu created and enabled: ${mainRichMenuId}`);
  console.log(`Purchase rich menu created: ${purchaseRichMenuId}`);
  console.log(`Order rich menu created: ${orderRichMenuId}`);
  console.log(`Movement rich menu created: ${movementRichMenuId}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function getRichMenuSetupConfig(): RichMenuSetupConfig {
  loadEnvFile();

  return {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
    images: getRichMenuImageConfig(),
  };
}

function getRichMenuImageConfig(): RichMenuImageConfig {
  return {
    mainImagePath:
      process.env.RICH_MENU_MAIN_IMAGE_PATH ||
      "public/assets/rich-menu-main-compact.jpg",
    purchaseImagePath:
      process.env.RICH_MENU_PURCHASE_IMAGE_PATH ||
      "public/assets/rich-menu-purchase.jpg",
    orderImagePath:
      process.env.RICH_MENU_ORDER_IMAGE_PATH ||
      "public/assets/rich-menu-order.jpg",
    movementImagePath:
      process.env.RICH_MENU_MOVEMENT_IMAGE_PATH ||
      "public/assets/rich-menu-movement.jpg",
  };
}

function loadEnvFile(filePath = path.join(process.cwd(), ".env")): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(trimmedLine.slice(separatorIndex + 1).trim());

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
