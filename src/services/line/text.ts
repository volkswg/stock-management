import { LineTextCommand } from "@/services/line/enum";

export function classifyLineTextCommand(
  text: string | undefined,
): LineTextCommand | undefined {
  const normalizedText = text?.trim().toLowerCase();
  if (!normalizedText) {
    return undefined;
  }

  if (normalizedText === "create:order") {
    return LineTextCommand.CreateOrder;
  }

  if (normalizedText === "order:bill:complete") {
    return LineTextCommand.CompleteBill;
  }

  if (normalizedText === "order:product:complete") {
    return LineTextCommand.CompleteProducts;
  }

  return LineTextCommand.Legacy;
}
