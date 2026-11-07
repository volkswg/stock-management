export function parseQuantity(text: string): { quantity: string; remark: string } | undefined {
  // Amounts must be standalone whitespace-separated numbers, not part of a
  // label such as "Lot2" or "Set2ชิ้น". Count every amount, including on one line.
  const total = text.split(/\s+/)
    .filter((value) => /^\d[\d,]*(?:\.\d+)?$/.test(value))
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return undefined;
  return { quantity: String(total), remark: /^\d[\d,]*(?:\.\d+)?$/.test(text) ? "" : text };
}

export function isValidMovementQuantity(value: string): boolean {
  const quantity = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(quantity) && quantity > 0;
}

export class MovementQuantityRequiredError extends Error {
  constructor() {
    super("Set a quantity greater than 0 for every item before marking delivered.");
    this.name = "MovementQuantityRequiredError";
  }
}


export {summarizeMovementJourney}from "./domain/journey-quantities";
