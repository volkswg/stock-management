import { executeCommand, hashIntent } from "@/infrastructure/persistence/postgres/commands";
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { currentTransaction, storageMode, stagingSettings, transaction, stagingReadOnly, PersistenceFailure } from "@/infrastructure/persistence/postgres/database";

type StoredResponse = { status: number; body: string; headers: [string,string][] };
function equal(a: string, b: string) { const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left,right); }
export function authorizeStaging(request: Request) {
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
        stagingSettings(); authorizeStaging(request);
        return Response.json({error:"Staging is read-only."},{status:405,headers:{Allow:"GET, HEAD"}}) as Result;
      }
      // Only the signature-verifying LINE entrypoint may opt into this boundary.
      // A caller-controlled URL must never exempt an ordinary handler from auth.
      const isLine = options.lineWebhook && new URL(request.url).pathname === "/api/line/webhook";
      if (isLine) { stagingSettings(); return handler(...args); }
      authorizeStaging(request);
      const method=request.method.toUpperCase();
      if (method === "GET" || method === "HEAD") return await transaction(false,async()=>{
        const response=await handler(...args);
        response.headers.set("x-stock-revision",await readRevision());
        return response;
      });
      const kind=method+":"+new URL(request.url).pathname;
      const stored = await executeCommand<StoredResponse>(kind,request.headers.get("Idempotency-Key") || "",hashIntent({query:new URL(request.url).search,body:await requestIntent(request)}),async () => {
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
