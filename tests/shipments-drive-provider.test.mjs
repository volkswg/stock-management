import assert from "node:assert/strict";
import test from "node:test";
import { loadSource } from "./helpers/load-source.mjs";
import { driveRoute, shippingBillRequest } from "./helpers/shipments-drive.mjs";
import { ShipmentClock, shipmentParams } from "./helpers/shipments.mjs";
const constants = loadSource("src/externals/google/drive/const.ts");
function provider({ publicLink = false, fetch, events = [], errors = [] }) {
  class Clock extends ShipmentClock { static now() { events.push("boundary"); return 123; } }
  const { GoogleDriveService } = loadSource("src/externals/google/drive/GoogleDriveService.ts", { imports: { "./const": constants }, globals: { Error, Date: Clock, fetch, console: { error: (...args) => errors.push(args) } } });
  return new GoogleDriveService({ folderId: "folder/id", makeFilesReadableByLink: publicLink, auth: { getAccessToken: async () => { events.push("token"); return "fake-token"; } } });
}
test("real unchanged Drive provider builds exact multipart/related bytes/headers/URL before token and preserves returned object", async () => {
  const events = [], requests = [], metadata = { id: "f/id", name: "bill.pdf", webViewLink: "url", webContentLink: "download" };
  const service = provider({ events, fetch: async (url, init) => { events.push("upload"); requests.push({ url, init }); return { ok: true, json: async () => metadata }; } });
  assert.deepEqual(events, []); const bytes = Buffer.from([1, 2, 3]), result = await service.uploadImage({ fileName: "bill.pdf", contentType: "application/pdf", bytes });
  assert.equal(result, metadata); assert.deepEqual(events, ["boundary", "token", "upload"]); assert.equal(requests.length, 1);
  const { url, init } = requests[0]; assert.equal(url, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink&supportsAllDrives=true");
  assert.equal(init.method, "POST"); assert.equal(init.headers.Authorization, "Bearer fake-token"); assert.equal(init.headers["Content-Type"], "multipart/related; boundary=stock-management-123");
  const expected = Buffer.concat([Buffer.from('--stock-management-123\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"bill.pdf","parents":["folder/id"]}\r\n--stock-management-123\r\nContent-Type: application/pdf\r\n\r\n'), bytes, Buffer.from('\r\n--stock-management-123--\r\n')]);
  assert.deepEqual(init.body, expected); assert.equal(init.headers["Content-Length"], String(expected.length));
});

test("real Drive provider preserves optional anyone-reader permission and encoded delete/health requests", async () => {
  const requests = [], service = provider({ publicLink: true, fetch: async (url, init) => { requests.push({ url, init }); return Response.json(init.method === "GET" ? { mimeType: "application/vnd.google-apps.folder" } : { id: "f/id", webViewLink: "url" }); } });
  await service.uploadImage({ fileName: "bill", contentType: "image/png", bytes: Buffer.from("synthetic") }); await service.deleteFile("f/id"); await service.checkConnection();
  assert.deepEqual(requests.map(r => r.init.method), ["POST", "POST", "DELETE", "GET"]);
  assert.equal(requests[1].url, "https://www.googleapis.com/drive/v3/files/f%2Fid/permissions?supportsAllDrives=true"); assert.deepEqual(JSON.parse(requests[1].init.body), { role: "reader", type: "anyone" });
  assert.equal(requests[2].url, "https://www.googleapis.com/drive/v3/files/f%2Fid?supportsAllDrives=true"); assert.equal(requests[3].url, "https://www.googleapis.com/drive/v3/files/folder%2Fid?fields=id,name,mimeType&supportsAllDrives=true");
});

test("real Drive permission failure keeps provider-internal deletion/logging and workflow performs no duplicate cleanup", async () => {
  for (const cleanupFailure of [false, true]) {
    const requests = [], errors = [], service = provider({ publicLink: true, errors, fetch: async (url, init) => {
      requests.push({ url, init });
      if (url.includes("upload/drive")) return Response.json({ id: "f/id", webViewLink: "url" });
      if (url.includes("permissions")) return new Response("denied", { status: 403 });
      return cleanupFailure ? new Response("cleanup", { status: 500 }) : new Response(null, { status: 204 });
    } });
    const h = driveRoute({ drive: service }), r = await h.route.PATCH(shippingBillRequest(), shipmentParams());
    assert.equal(r.status, 500); assert.deepEqual(await r.json(), { error: "Failed to update shipment status." });
    assert.deepEqual(requests.map(r => r.init.method), ["POST", "POST", "DELETE"]); assert.deepEqual(h.trace, [["config"], ["sheets"], ["drive"]]);
    assert.equal(h.errors[0][1].error, "Google Drive permission setup failed: 403 denied"); assert.equal(errors.length, cleanupFailure ? 1 : 0);
    if (cleanupFailure) { assert.equal(errors[0][0], "Failed to clean up Google Drive file"); assert.equal(errors[0][1].fileId, "f/id"); assert.equal(errors[0][1].error, "Google Drive file deletion failed: 500 cleanup"); }
  }
});

test("real Drive upload/delete/health failures retain original errors, network rejection identity and no retries", async () => {
  for (const method of ["uploadImage", "deleteFile", "checkConnection"]) {
    let requests = 0; const error = new Error("network"); const service = provider({ fetch: async () => { requests++; throw error; } });
    await assert.rejects(method === "uploadImage" ? service[method]({ fileName: "bill", contentType: "image/png", bytes: Buffer.from("x") }) : method === "deleteFile" ? service[method]("f") : service[method](), e => e === error); assert.equal(requests, 1);
  }
  const wrongFolder = provider({ fetch: async () => Response.json({ mimeType: "image/png" }) }); await assert.rejects(wrongFolder.checkConnection(), /Google Drive health check failed: configured ID is not a folder/);
  const failure = provider({ fetch: async () => new Response("unavailable", { status: 503 }) });
  await assert.rejects(failure.uploadImage({ fileName: "bill", contentType: "image/png", bytes: Buffer.from("x") }), /Google Drive upload failed: 503 unavailable/);
});
