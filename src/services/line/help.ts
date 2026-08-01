export function isHelpCommand(text: string): boolean {
  return text.trim().toLowerCase() === "help";
}

export function formatHelpText(): string {
  return [
    "Available commands:",
    "help",
    "create:purchase-order",
    "show <PO number>",
  ].join("\n");
}
