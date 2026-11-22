import type {Product, ProductInput} from './contracts';
type Pending = { version: 1; key: string; body: string; method: string; path: string; scope: string };
const prefix = 'stock-product-catalogue-pending:v1:';
const inFlight = new Map<string, { body: string; promise: Promise<unknown> }>();
export class CatalogueRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly uncertain = false) { super(message); }
}
export function pendingCatalogueRequest(scope: string): Pending | null {
  const raw = sessionStorage.getItem(prefix + scope);
  if (!raw) return null;
  let value: Pending;
  try { value = JSON.parse(raw); } catch { throw new CatalogueRequestError('Pending product request needs operator review.', 0, undefined, true); }
  if (!value || value.version !== 1 || value.scope !== scope || typeof value.body !== 'string' ||
      !/^product:[a-f0-9-]{36}$/.test(value.key) ||
      !((value.method === 'POST' && value.path === scope) || (['PATCH', 'DELETE'].includes(value.method) && /^\/api\/products\/[1-9][0-9]{0,18}$/.test(value.path)))) {
    throw new CatalogueRequestError('Pending product identity needs operator review.', 0, undefined, true);
  }
  return value;
}
async function json<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json', 'x-stock-edit-protocol': 'row-v1' }, cache: 'no-store', signal });
  const value = await response.json();
  if (!response.ok) throw new CatalogueRequestError(value.error || 'Could not load the product catalogue.', response.status, value.code);
  return value;
}
export const searchCatalogue = (query: string, {signal}: {signal?: AbortSignal} = {}) => json<{ products: Product[] }>('/api/products?q=' + encodeURIComponent(query), signal);
export const readCatalogueProduct = (id: string) => json<{ product: Product }>('/api/products/' + encodeURIComponent(id));
async function send<T>(path: string, method: string, body: string, scope: string): Promise<T> {
  const existing = pendingCatalogueRequest(scope);
  if (existing && (existing.body !== body || existing.method !== method || existing.path !== path)) {
    throw new CatalogueRequestError(`The previous product operation needs confirmation. Retry that saved request. Reference: ${existing.key}`, 0, undefined, true);
  }
  const pending = existing ?? { version: 1 as const, key: 'product:' + crypto.randomUUID(), body, method, path, scope };
  const storageKey = prefix + scope, encoded = JSON.stringify(pending);
  try {
    sessionStorage.setItem(storageKey, encoded);
    if (sessionStorage.getItem(storageKey) !== encoded) throw new Error();
  } catch { throw new CatalogueRequestError('Cannot preserve the product request safely. Enable session storage before saving.', 0); }
  let response: Response, value: unknown;
  try {
    response = await fetch(path, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': pending.key, 'x-stock-edit-protocol': 'row-v1' }, body });
    value = await response.json();
  } catch { throw new CatalogueRequestError(`Product save is not confirmed. Retry the saved request without changing it. Reference: ${pending.key}`, 0, undefined, true); }
  if (!value || typeof value !== 'object') throw new CatalogueRequestError(`Unconfirmed product response. Reference: ${pending.key}`, response.status, undefined, true);
  const result = value as { error?: string; code?: string; item?: {itemId: string; revision: string}; product?: Product };
  if (response.ok) {
    const valid = method === 'POST' ? typeof result.item?.itemId === 'string' && typeof result.item?.revision === 'string' : typeof result.product?.id === 'string' && typeof result.product?.revision === 'string';
    if (!valid) throw new CatalogueRequestError(`Unconfirmed product response. Reference: ${pending.key}`, response.status, undefined, true);
    try { sessionStorage.removeItem(storageKey); } catch { throw new CatalogueRequestError(`Saved product response could not be cleared locally. Retry the saved request. Reference: ${pending.key}`, response.status, undefined, true); }
    return value as T;
  }
  const uncertain = !!existing || response.status >= 500;
  if (!uncertain && response.status >= 400 && response.status < 500) sessionStorage.removeItem(storageKey);
  throw new CatalogueRequestError((result.error || 'Product save failed.') + (uncertain ? ` Keep this request for confirmation. Reference: ${pending.key}` : ''), response.status, result.code, uncertain);
}
export function catalogueMutation<T>(path: string, method: string, value: unknown, scope = path): Promise<T> {
  const body = JSON.stringify(value), active = inFlight.get(scope);
  if (active) {
    if (active.body !== JSON.stringify({ path, method, body })) return Promise.reject(new CatalogueRequestError('A different product operation is still pending.', 0, undefined, true));
    return active.promise as Promise<T>;
  }
  const promise = send<T>(path, method, body, scope).finally(() => { if (inFlight.get(scope)?.promise === promise) inFlight.delete(scope); });
  inFlight.set(scope, { body: JSON.stringify({ path, method, body }), promise });
  return promise;
}
export function retryCatalogueRequest<T>(scope: string) {
  const saved = pendingCatalogueRequest(scope);
  if (!saved) throw new Error('No pending product operation.');
  return catalogueMutation<T>(saved.path, saved.method, JSON.parse(saved.body), scope);
}
export function updateCatalogueProduct(product: Product, input: ProductInput, scope: string) {
  return catalogueMutation<{ product: Product }>('/api/products/' + encodeURIComponent(product.id), 'PATCH', { ...input, expectedRevision: product.revision }, scope);
}
export function archiveCatalogueProduct(product: Product, scope: string) {
  return catalogueMutation<{ product: Product }>('/api/products/' + encodeURIComponent(product.id), 'DELETE', { expectedRevision: product.revision }, scope);
}
