import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ProductStaffSettings } from "@/config/product-master-access";
export const PRODUCT_STAFF_COOKIE = "product_master_staff";
export const PRODUCT_STAFF_SESSION_SECONDS = 8 * 60 * 60;
export class ProductAccessError extends Error {
  constructor(message: string, readonly status: number) { super(message);this.name = "ProductAccessError"; }
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const signature = (payload: string, secret: string) => createHmac("sha256", secret).update(`product-master-session.v1\n${payload}`).digest();
export function assertProductWriteOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new ProductAccessError("Same-origin requests are required.", 403);
}
export function issueProductStaffSession(settings: ProductStaffSettings, id: unknown, accessKey: unknown, nowSeconds: number, audience: string): string {
  const staff = typeof id === "string" ? settings.staff.find(staff => staff.id === id) : undefined;
  const candidate = typeof accessKey === "string" && /^[A-Za-z0-9_-]{43}$/.test(accessKey) ? hash(accessKey) : hash("invalid-staff-key");
  const expected = staff?.keyHash ?? "0".repeat(64);
  const valid = timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex"));
  if (!staff || !valid) throw new ProductAccessError("Staff sign-in failed.", 401);
  const payload = Buffer.from(JSON.stringify({ v: 1, aud: audience, sub: staff.id, rev: hash(staff.keyHash), iat: nowSeconds, exp: nowSeconds + PRODUCT_STAFF_SESSION_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload, settings.sessionSecret).toString("base64url")}`;
}
export function readProductStaffSession(request: Request, settings: ProductStaffSettings | undefined, nowSeconds: number): { id: string } | undefined {
  if (!settings) return undefined;
  const cookies = request.headers.get("cookie")?.split(";").map(value => value.trim()) ?? [];
  const matches = cookies.filter(value => value.startsWith(`${PRODUCT_STAFF_COOKIE}=`));
  if (matches.length !== 1) return undefined;
  const value = matches[0].slice(PRODUCT_STAFF_COOKIE.length + 1);
  if (value.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return undefined;
  const [payload, supplied] = value.split(".");
  const expected = signature(payload, settings.sessionSecret), actual = Buffer.from(supplied, "base64url");
  if (actual.length !== expected.length || actual.toString("base64url") !== supplied || !timingSafeEqual(expected, actual)) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (claims.v !== 1 || claims.aud !== new URL(request.url).origin || typeof claims.sub !== "string" || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.exp - claims.iat !== PRODUCT_STAFF_SESSION_SECONDS || claims.iat > nowSeconds + 60 || claims.exp <= nowSeconds) return undefined;
    const staff = settings.staff.find(staff => staff.id === claims.sub);
    return staff && claims.rev === hash(staff.keyHash) ? { id: staff.id } : undefined;
  } catch { return undefined; }
}
export function requireProductStaff(request: Request, settings: ProductStaffSettings | undefined, nowSeconds: number): { id: string } {
  assertProductWriteOrigin(request);
  const url = new URL(request.url);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new ProductAccessError("HTTPS is required for staff access.", 403);
  if (!settings?.staff.length) throw new ProductAccessError("Product Master staff access is disabled. Contact the owner.", 503);
  const staff = readProductStaffSession(request, settings, nowSeconds);
  if (!staff) throw new ProductAccessError("Staff sign-in is required for Product Master and association changes.", 401);
  return staff;
}
export function productStaffCookie(request: Request, value: string, remove = false): string {
  const url = new URL(request.url), local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new ProductAccessError("HTTPS is required for staff access.", 403);
  return `${PRODUCT_STAFF_COOKIE}=${value}; Path=/api/; HttpOnly; SameSite=Strict; Max-Age=${remove ? 0 : PRODUCT_STAFF_SESSION_SECONDS}${url.protocol === "https:" ? "; Secure" : ""}`;
}
