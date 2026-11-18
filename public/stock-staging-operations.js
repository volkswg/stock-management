/* Loaded only by the server-selected Supabase layout. Contains no secrets. */
(() => {
  const originalFetch = window.fetch.bind(window);
  const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
  const digest = async bytes => hex(await crypto.subtle.digest("SHA-256", bytes));
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)])) : value;
  let revision;
  const edits = new Map();
  const scopeKeys = url => {
    const parts = url.pathname.split("/"), family = parts[2];
    if (parts[1] !== "api" || !["orders", "movements"].includes(family)) return [];
    let id;
    try { id = parts[3] ? decodeURIComponent(parts[3]).trim() : undefined; } catch { return []; }
    if (family === "orders" && id === "with-images" && parts.length === 4) id = undefined;
    if (family === "movements" && id) id = id.toUpperCase();
    const collection = `/api/${family}`;
    return id ? [`${collection}/${encodeURIComponent(id)}`, collection] : [collection];
  };
  const rememberRevision = (response, url) => {
    const observed = response.headers.get("x-stock-revision");
    if (!observed) return;
    const next = /^"stock-v2-(\d+)"$/.exec(observed), current = /^"stock-v2-(\d+)"$/.exec(revision || "");
    // Completed retries return their original revision, even after later writes.
    if (!next || !current || BigInt(next[1]) >= BigInt(current[1])) revision = observed;
    const scope = response.headers.get("x-stock-edit-scope"), value = response.headers.get("x-stock-edit-revision");
    if (response.ok && next && scopeKeys(url).includes(scope) && /^"stock-edit-v1-[a-f0-9]{64}"$/.test(value || "")) {
      const previous = edits.get(scope), stamp = BigInt(next[1]);
      if (!previous || stamp >= previous.stamp) edits.set(scope, { value, stamp });
    }
  };
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(method)) {
      const response=await originalFetch(input,init);
      if (url.origin === location.origin && url.pathname.startsWith("/api/")) rememberRevision(response, url);
      return response;
    }
    const request = new Request(input instanceof Request ? input.clone() : url, init);
    if (request.headers.has("Idempotency-Key")) {
      const response = await originalFetch(request);
      rememberRevision(response, url);
      return response;
    }
    let identity;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      identity = [];
      for (const [key, value] of (await request.clone().formData()).entries()) identity.push(typeof value === "string" ? [key, value] : [key, value.name, value.type, await digest(await value.arrayBuffer())]);
    } else if (request.headers.get("content-type")?.split(";")[0].startsWith("image/")) {
      identity = { contentType: request.headers.get("content-type").split(";")[0], sha256: await digest(await request.clone().arrayBuffer()) };
    } else {
      const text = await request.clone().text();
      try { identity = canonical(JSON.parse(text)); } catch { identity = text; }
    }
    const fingerprint = await digest(new TextEncoder().encode(JSON.stringify([request.method, url.pathname, url.search, identity])));
    const storageKey = "stock-pending-operation:" + fingerprint;
    // Storage failure is intentionally fatal before POST; do not silently invent
    // a different operation identity after an ambiguous submission.
    const raw = sessionStorage.getItem(storageKey);
    let pending;
    if (raw) {
      try { pending = JSON.parse(raw); } catch {
        // An old key-only edit has no recoverable view precondition. Preserve
        // its identity for reconciliation instead of inventing a fresh view.
        if (scopeKeys(url).length) throw Error("A pending edit from an older page needs review before retrying. Keep its operation reference and refresh only after checking its outcome.");
        pending = { version: 1, key: raw, expected: revision };
      }
      if (pending?.version !== 1 || typeof pending.key !== "string" || !/^[a-zA-Z0-9_:.-]{8,200}$/.test(pending.key) ||
          (pending.expected !== undefined && typeof pending.expected !== "string") ||
          (pending.scope !== undefined && (!scopeKeys(url).includes(pending.scope) || typeof pending.expected !== "string"))) throw Error("Pending edit metadata needs review before retrying.");
    } else {
      const scope = scopeKeys(url).find(key => edits.has(key));
      const explicit = request.headers.get("If-Match");
      pending = { version: 1, key: crypto.randomUUID(), expected: explicit || (scope ? edits.get(scope).value : revision),
        scope: explicit ? request.headers.get("x-stock-edit-scope") || undefined : scope };
      const encoded = JSON.stringify(pending);
      sessionStorage.setItem(storageKey, encoded);
      if (sessionStorage.getItem(storageKey) !== encoded) throw Error("Cannot preserve this edit safely. Enable session storage before saving.");
    }
    request.headers.set("Idempotency-Key", pending.key);
    if (pending.expected) request.headers.set("If-Match", pending.expected);
    if (pending.scope) request.headers.set("x-stock-edit-scope", pending.scope);
    const response = await originalFetch(request);
    rememberRevision(response, url);
    const readJson = response.json.bind(response);
    response.json = async () => {
      const body = await readJson();
      if (response.ok || (response.status === 409 && (body?.code === "stock_revision_conflict" || body?.error === "Storage revision changed. Refresh before retrying."))) sessionStorage.removeItem(storageKey);
      return body;
    };
    return response;
  };
})();
