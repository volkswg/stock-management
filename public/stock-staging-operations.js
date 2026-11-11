/* Loaded only by the server-selected Supabase staging layout. Contains no secrets. */
(() => {
  const originalFetch = window.fetch.bind(window);
  const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
  const digest = async bytes => hex(await crypto.subtle.digest("SHA-256", bytes));
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)])) : value;
  let revision;
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, location.href);
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(method)) {
      const response=await originalFetch(input,init);
      if (url.origin === location.origin && url.pathname.startsWith("/api/")) revision=response.headers.get("x-stock-revision") || revision;
      return response;
    }
    const request = new Request(input instanceof Request ? input.clone() : url, init);
    if (request.headers.has("Idempotency-Key")) return originalFetch(request);
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
    let key = sessionStorage.getItem(storageKey);
    if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); }
    request.headers.set("Idempotency-Key", key);
    if(revision) request.headers.set("If-Match",revision);
    const response = await originalFetch(request);
    revision=response.headers.get("x-stock-revision") || revision;
    const readJson = response.json.bind(response);
    response.json = async () => {
      const body = await readJson();
      if (response.ok) sessionStorage.removeItem(storageKey);
      return body;
    };
    return response;
  };
})();
