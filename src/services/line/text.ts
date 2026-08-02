import { LineTextCommand } from "@/services/line/enum";
import { isHelpCommand } from "./help";

export function classifyLineTextCommand(
  text: string | undefined,
): LineTextCommand | undefined {
  const normalizedText = text?.trim().toLowerCase();
  if (!normalizedText) {
    return undefined;
  }

  if (isHelpCommand(normalizedText)) {
    return LineTextCommand.Help;
  }

  if (normalizedText === "order:create") {
    return LineTextCommand.CreateOrder;
  }

  return LineTextCommand.Legacy;
}
