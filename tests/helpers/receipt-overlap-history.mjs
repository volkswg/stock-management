// Bounded inverse for immutable pre-fix architecture witnesses only. Runtime
// tests/loaders still execute the real current provider, including this fix.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const file = 'src/infrastructure/external/loyverse/LoyverseService.ts';
const before = "5496246546cfcc6c230d351928ecda459c82780d8b8cd3f6d8cd957cc28e2642", after = "2126a23a56bc40be309c2b08b3411811b74d89265348356d6e3de61c87a768e4";
const addition = "// Pages may overlap while the provider is being updated. Preserve the first\n// complete representation only when every value agrees; never guess which\n// financial/status version should be saved. Validation finishes before callers\n// receive any receipts, so both storage paths can reject the whole sync.\nfunction uniqueReceipts(receipts: LoyverseReceipt[]): LoyverseReceipt[] {\n  const seen = new Map<string, string>();\n  const result: LoyverseReceipt[] = [];\n  for (const receipt of receipts) {\n    const id = receipt.receipt_number;\n    if (typeof id !== \"string\" || !id.trim()) {\n      throw new Error(\"Loyverse returned a receipt without a valid identity. No receipts were returned.\");\n    }\n    const signature = JSON.stringify(canonicalReceiptValue(receipt));\n    const previous = seen.get(id);\n    if (previous !== undefined) {\n      if (previous !== signature) {\n        throw new Error(\"Loyverse returned conflicting versions of a receipt. No receipts were returned.\");\n      }\n      continue;\n    }\n    seen.set(id, signature);\n    result.push(receipt);\n  }\n  return result;\n}\n\nfunction canonicalReceiptValue(value: unknown): unknown {\n  if (Array.isArray(value)) return value.map(canonicalReceiptValue);\n  if (value !== null && typeof value === \"object\") {\n    const record = value as Record<string, unknown>;\n    return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonicalReceiptValue(record[key])]));\n  }\n  return value;\n}\n\n";
const hash = value => createHash('sha256').update(value).digest('hex');
export function restoreReceiptOverlapSource(name, source) {
  if (name !== file || hash(source) === before) return source;
  assert.equal(hash(source), after, 'Unreviewed receipt-overlap source change');
  assert.equal(source.split(addition).length, 2);
  const restored = source.replace('return uniqueReceipts(filterReceiptsByReceiptDate(receipts, query));', 'return filterReceiptsByReceiptDate(receipts, query);').replace(addition, '');
  assert.equal(hash(restored), before);
  return restored;
}
