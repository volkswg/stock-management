export function parseQuantity(text: string): { quantity: string; remark: string } | undefined {
  const total = text.split(/\r?\n/)
    .map((line) => line.match(/\d[\d,]*(?:\.\d+)?/g)?.at(-1))
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return undefined;
  return { quantity: String(total), remark: /^\d[\d,]*(?:\.\d+)?$/.test(text) ? "" : text };
}
