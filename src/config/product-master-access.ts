import "server-only";
export type ProductStaffSettings = { sessionSecret: string; staff: Array<{ id: string; keyHash: string }> };
export function readProductStaffSettings(): ProductStaffSettings | undefined {
  const raw = process.env.PRODUCT_MASTER_STAFF_KEYS_JSON?.trim(), sessionSecret = process.env.PRODUCT_MASTER_SESSION_SECRET?.trim();
  if ((!raw || raw === "[]") && !sessionSecret) return undefined;
  if (!raw || raw.length > 16_384 || !sessionSecret || !/^[A-Za-z0-9_-]{43,128}$/.test(sessionSecret)) throw new Error("Product Master staff access is not configured correctly.");
  let staff: unknown;
  try { staff = JSON.parse(raw); } catch { throw new Error("Product Master staff access is not configured correctly."); }
  if (!Array.isArray(staff) || staff.length > 100) throw new Error("Product Master staff access is not configured correctly.");
  const ids = new Set<string>(), hashes = new Set<string>();
  const validated = staff.map(record => {
    if (!record || typeof record !== "object" || typeof record.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(record.id) || typeof record.keyHash !== "string" || !/^[a-f0-9]{64}$/.test(record.keyHash) || ids.has(record.id) || hashes.has(record.keyHash)) throw new Error("Product Master staff access is not configured correctly.");
    ids.add(record.id);hashes.add(record.keyHash);return { id: record.id, keyHash: record.keyHash };
  });
  return { sessionSecret, staff: validated };
}
