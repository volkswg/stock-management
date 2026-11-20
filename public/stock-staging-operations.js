/* Loaded only by the server-selected Supabase layout. Contains no secrets. */
(() => {
  const originalFetch = window.fetch.bind(window);
  const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
  const digest = async bytes => hex(await crypto.subtle.digest("SHA-256", bytes));
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)])) : value;
  let revision;
  const edits = new Map();
  const rows = new Map();
  let rowProtocol = false;
  const part = value => encodeURIComponent(value.trim());
  const rowKey = (url, body = {}) => {
    let p; try { p = url.pathname.split('/').map(decodeURIComponent); } catch { return; }
    const [, api, family, raw, child, id, suffix] = p;
    if (api !== 'api') return;
    if (['orders','movements'].includes(family)) {
      if (!raw || raw === 'with-images') return;
      const parent = family === 'movements' ? raw.trim().toUpperCase() : raw.trim();
      if (child === 'items' && id && (!suffix || suffix === 'image')) return `/api/${family}/${part(parent)}/items/${part(family === 'movements' ? id.toUpperCase() : id)}`;
      if (!child) return `/api/${family}/${part(parent)}`;
      return;
    }
    if (family === 'shipments' && raw && !child) return `/api/shipments/${part(raw)}`;
    if (family === 'employees') {
      if (raw === 'timesheets' && child) return `/api/employees/timesheets/${part(child)}`;
      if (raw === 'advances' && typeof body.id === 'string' && body.id.trim()) return `/api/employees/advances/${part(body.id)}`;
      if (raw && !['payroll','timesheets','advances'].includes(raw) && !child) return `/api/employees/${part(raw)}`;
    }
    if (family === 'expenses' && typeof body.id === 'string' && body.id.trim()) {
      if (!raw) return `/api/expenses/${part(body.id)}`;
      if (raw === 'masters' && ['shops','categories'].includes(child)) return `/api/expenses/masters/${child}/${part(body.id)}`;
    }
    if (family === 'stock-adjustments' && typeof body.id === 'string' && body.id.trim()) return `/api/stock-adjustments/${part(body.id)}`;
    if (family === 'stock-counts' || (family === 'sales' && raw === 'profit-summary' && child === 'cost-overrides')) {
      if (typeof body.month === 'string' && body.month.trim() && typeof body.accountId === 'string' && body.accountId.trim()) return `${url.pathname}?month=${part(body.month)}&accountId=${part(body.accountId)}`;
    }
  };
  const batchKeys = (url, body) => {
    if (!/^\/api\/orders\/[^/]+\/items$/.test(url.pathname) || !Array.isArray(body?.items)) return [];
    const parent = decodeURIComponent(url.pathname.split('/')[3]).trim();
    return [...new Set(body.items.filter(i=>typeof i?.id === 'string' && i.id.trim()).map(i=>`/api/orders/${part(parent)}/items/${part(i.id)}`))].sort();
  };
  const rememberRows = async response => {
    if (!response.ok || response.headers.get('x-stock-edit-protocol') !== 'row-v1') return;
    rowProtocol = true;
    const stamp = /^"stock-v2-(\d+)"$/.exec(response.headers.get('x-stock-revision') || '');
    if (!stamp || !response.headers.get('content-type')?.includes('application/json')) return;
    let body; try { body = await response.clone().json(); } catch { return; }
    if (!Array.isArray(body.stockEditRows)) return;
    for (const row of body.stockEditRows) {
      if (!row || typeof row.scope !== 'string' || !row.scope.startsWith('/api/') || !/^"stock-row-v1-[a-f0-9]{64}"$/.test(row.token || '')) continue;
      const previous = rows.get(row.scope), observed = BigInt(stamp[1]);
      if (!previous || observed >= previous.stamp) rows.set(row.scope, {value:row.token,stamp:observed});
    }
  };
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
      const local = url.origin === location.origin && url.pathname.startsWith('/api/');
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (local) headers.set('x-stock-edit-protocol','row-v1');
      const response=await originalFetch(input,local ? {...init,headers} : init);
      if (local) { rememberRevision(response, url); await rememberRows(response); }
      return response;
    }
    const request = new Request(input instanceof Request ? input.clone() : url, init);
    request.headers.set('x-stock-edit-protocol','row-v1');
    if (request.headers.has("Idempotency-Key")) {
      const response = await originalFetch(request);
      rememberRevision(response, url);
      await rememberRows(response);
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
        if (scopeKeys(url).length || rowKey(url,identity) || batchKeys(url,identity).length) throw Error("A pending edit from an older page needs review before retrying. Keep its operation reference and refresh only after checking its outcome.");
        pending = { version: 1, key: raw, expected: revision };
      }
      const validScope = pending?.scope === undefined || (typeof pending?.scope === 'string' && typeof pending.expected === 'string' && (
        /^"stock-row-v1-[a-f0-9]{64}"$/.test(pending.expected) ? pending.scope === rowKey(url,identity) :
        /^"stock-batch-v1-[a-f0-9]{64}"$/.test(pending.expected) ? pending.scope === url.pathname && method === 'PATCH' && batchKeys(url,identity).length > 0 :
        scopeKeys(url).includes(pending.scope)
      ));
      if (pending?.version !== 1 || typeof pending.key !== "string" || !/^[a-zA-Z0-9_:.-]{8,200}$/.test(pending.key) ||
          (pending.expected !== undefined && typeof pending.expected !== "string") || !validScope) throw Error("Pending edit metadata needs review before retrying.");
    } else {
      const batch = method === 'PATCH' ? batchKeys(url,identity) : [];
      if (rowProtocol && batch.some(key=>!rows.has(key))) throw Error('Read these records before editing. Refresh and review your edit.');
      const batchToken = rowProtocol && batch.length ? '"stock-batch-v1-' + await digest(new TextEncoder().encode(JSON.stringify(batch.map(key=>[key,rows.get(key).value])))) + '"' : undefined;
      const row = rowKey(url, identity);
      if (rowProtocol && row && !rows.has(row)) throw Error('Read this record before editing. Refresh and review your edit.');
      const scope = batchToken ? url.pathname : rowProtocol ? row : scopeKeys(url).find(key => edits.has(key));
      const explicit = request.headers.get("If-Match");
      pending = { version: 1, key: crypto.randomUUID(), expected: explicit || batchToken || (rowProtocol ? (scope ? rows.get(scope).value : undefined) : (scope ? edits.get(scope).value : revision)),
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
    await rememberRows(response);
    const readJson = response.json.bind(response);
    response.json = async () => {
      const body = await readJson();
      if (response.ok || (response.status === 409 && (body?.code === "stock_revision_conflict" || body?.error === "Storage revision changed. Refresh before retrying."))) sessionStorage.removeItem(storageKey);
      return body;
    };
    return response;
  };
})();
