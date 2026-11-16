import { executeCommand, hashIntent } from "@/infrastructure/persistence/postgres/commands";
import { executeUploadCommand } from "@/infrastructure/persistence/postgres/uploads";
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { currentTransaction, storageMode, stagingSettings, productionSettings, transaction, stagingReadOnly, PersistenceFailure } from "@/infrastructure/persistence/postgres/database";

type StoredResponse = { status: number; body: string; headers: [string,string][] };
function equal(a: string, b: string) { const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left,right); }
export function authorizeStaging(request: Request) {
  // Production preserves the owner-selected legacy access behavior; staging still requires its bearer.
  if (process.env.VERCEL_ENV === "production") { productionSettings(); return; }
  const { token } = stagingSettings();
  const supplied = request.headers.get("authorization") || "";
  if (!equal(supplied, `Bearer ${token}`)) throw new PersistenceFailure(401,"Staging authorization required.");
}
function restore(value: StoredResponse): Response { return new Response([204,205,304].includes(value.status) ? null : Buffer.from(value.body,"base64"),{status:value.status,headers:value.headers}); }
class RejectedResponse extends PersistenceFailure {
  constructor(readonly response: Response) { super(response.status); }
}
async function requestIntent(request: Request) {
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await request.clone().formData(), entries: unknown[] = [];
    for (const [key,value] of form.entries()) entries.push(typeof value === "string" ? [key,value] : [key,value.name,value.type,createHash("sha256").update(Buffer.from(await value.arrayBuffer())).digest("hex")]);
    return hashIntent(entries);
  }
  const contentType = request.headers.get("content-type")?.split(";")[0] || "";
  if (contentType.startsWith("image/")) {
    return hashIntent({ contentType, sha256: createHash("sha256").update(Buffer.from(await request.clone().arrayBuffer())).digest("hex") });
  }
  const text = await request.clone().text();
  try { return hashIntent(JSON.parse(text)); } catch { return hashIntent(text); }
}
export function withPersistence<Args extends unknown[], Result extends Response>(handler: (...args: Args) => Promise<Result>, options: { lineWebhook?: true } = {}): (...args: Args) => Promise<Result> {
  return async (...args) => {
    try {
      if (storageMode() === "google-sheets") return handler(...args);
      const request = args[0] as Request;
      if (!(request instanceof Request)) throw new PersistenceFailure(503,"A staging request context is required.");
      if (stagingReadOnly() && !["GET","HEAD"].includes(request.method.toUpperCase())) {
        authorizeStaging(request);
        return Response.json({error:"Staging is read-only."},{status:405,headers:{Allow:"GET, HEAD"}}) as Result;
      }
      // Only the signature-verifying LINE entrypoint may opt into this boundary.
      // A caller-controlled URL must never exempt an ordinary handler from auth.
      const isLine = options.lineWebhook && new URL(request.url).pathname === "/api/line/webhook";
      if (isLine) { if (process.env.VERCEL_ENV === "production") productionSettings(); else stagingSettings(); return await handler(...args); }
      authorizeStaging(request);
      const method=request.method.toUpperCase();
      if (method === "GET" || method === "HEAD") return await transaction(false,async()=>{
        const response=await handler(...args);
        response.headers.set("x-stock-revision",await readRevision());
        return response;
      });
      const kind=method+":"+new URL(request.url).pathname;
      const contentType=request.headers.get("content-type") || "";
      const execute=contentType.startsWith("image/") || contentType.includes("multipart/form-data") ? executeUploadCommand : executeCommand;
      const stored = await execute<StoredResponse>(kind,request.headers.get("Idempotency-Key") || "",hashIntent({query:new URL(request.url).search,body:await requestIntent(request)}),async () => {
        const expected=request.headers.get("If-Match");
        if(expected && expected !== await readRevision()) throw new PersistenceFailure(409,"Storage revision changed. Refresh before retrying.");
        const response = await handler(...args);
        if (response.status >= 400) throw new RejectedResponse(response);
        response.headers.set("x-stock-revision",await readRevision());
        return { status:response.status,body:Buffer.from(await response.clone().arrayBuffer()).toString("base64"),headers:[...response.headers.entries()] };
      });
      return restore(stored) as Result;
    } catch (error) {
      if (error instanceof RejectedResponse) return error.response as Result;
      const safe=error instanceof PersistenceFailure ? error : new PersistenceFailure();
      return Response.json({error:safe.message},{status:safe.status}) as Result;
    }
  };
}
async function readRevision(): Promise<string> {
  const result=await currentTransaction().query("SELECT value::text AS revision FROM stock_operational.revision WHERE singleton");
  if (result.rowCount !== 1) throw new PersistenceFailure();
  return `"stock-v2-${result.rows[0].revision}"`;
}
export function activeDatabase() { return currentTransaction(); }

// Call only after the original raw-body HMAC check and JSON validation.
// Validate the raw batch, since the legacy parser filters malformed entries.
export function assertProductionLineCutoff(rawBody: Buffer): void {
  if (storageMode() !== "supabase" || process.env.VERCEL_ENV !== "production") return;
  const payload: unknown = JSON.parse(rawBody.toString("utf8"));
  const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const events = record(payload) && Array.isArray(payload.events) ? payload.events : undefined;
  const reject = (reason: string): never => {
    // Private server logs contain only delivery identities/times and disposition.
    console.warn("LINE migration cutoff rejected batch", {
      reason,
      events: events?.map((event: unknown) => ({
        id: record(event) && typeof event.webhookEventId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(event.webhookEventId) ? event.webhookEventId : null,
        timestamp: record(event) && typeof event.timestamp === "number" && Number.isSafeInteger(event.timestamp) ? event.timestamp : null,
      })),
    });
    throw new PersistenceFailure(503, "LINE is paused for the database migration. Please wait for reopening.");
  };
  if (!events) return reject("invalid_batch");
  // LINE's signed empty verification payload performs no business work.
  if (events.length === 0) return;
  const configured = process.env.STOCK_LINE_ACCEPT_EVENTS_AT_OR_AFTER_UTC;
  if (!configured || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(configured)) return reject("invalid_cutoff");
  const floor = Date.parse(configured);
  const canonical = configured.includes(".") ? configured : configured.replace("Z", ".000Z");
  if (!Number.isFinite(floor) || new Date(floor).toISOString() !== canonical) return reject("invalid_cutoff");
  for (const event of events) {
    if (!record(event) || typeof event.type !== "string" || typeof event.timestamp !== "number" ||
        !Number.isSafeInteger(event.timestamp) || event.timestamp < 0 || !Number.isFinite(new Date(event.timestamp).getTime())) return reject("invalid_timestamp");
    if (event.timestamp < floor) return reject("old_event");
  }
}
