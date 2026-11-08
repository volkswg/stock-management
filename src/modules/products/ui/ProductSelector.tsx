"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Divider, Form, Input, Modal, Select, Space, Tag, Typography } from "antd";
import type { Product, ProductEdit, ProductInput, ProductSuggestion } from "../contracts";
import { ProductStaffAccess, useProductStaffAccess } from "./ProductStaffAccess";
import { cancelProductCreation, createProduct, editProduct, getProduct, ProductApiError, searchProducts, suggestProducts } from "./api";
type PendingCreate = { version: 1; requestId: string; values: ProductInput; createdId?: string };
export function ProductSelector({ contextKey, linkedId, initialCode, initialImage, onSave }: {
  contextKey: string;linkedId: string | null;initialCode: string;initialImage: string;onSave(id: string | null): Promise<void>;
}) {
  const access = useProductStaffAccess();
  const [query, setQuery] = useState(initialCode), [options, setOptions] = useState<Product[]>([]), [selected, setSelected] = useState<string | null>(linkedId);
  const [current, setCurrent] = useState<Product>(), [error, setError] = useState<string>(), [notice, setNotice] = useState<string>(), [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<"create" | "edit">(), [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]), [readyToConfirm, setReadyToConfirm] = useState(false);
  const [pending, setPending] = useState<PendingCreate>(), [form] = Form.useForm<ProductEdit>();
  const [editRequest, setEditRequest] = useState<{ id: string; values: ProductEdit; revision: string; requestId: string }>();
  const storageKey = `product-create:v1:${contextKey}`;
  useEffect(() => {
    if (!linkedId) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved && (JSON.parse(saved) as PendingCreate).createdId === linkedId) sessionStorage.removeItem(storageKey);
    } catch { /* Leave the record intact; explicit creation recovery reports storage errors. */ }
  }, [linkedId, storageKey]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { searchProducts(query, true, controller.signal).then(result => { if (!controller.signal.aborted) setOptions(result.products); }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to search products."); }); }, 200);
    return () => { clearTimeout(timer);controller.abort(); };
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    if (selected) getProduct(selected, controller.signal).then(result => { if (!controller.signal.aborted) setCurrent(result.product); }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Linked product is unavailable."); });
    return () => controller.abort();
  }, [selected]);
  async function beginCreate() {
    setError(undefined);setNotice(undefined);setSuggestions([]);setReadyToConfirm(false);
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const saved = JSON.parse(stored) as PendingCreate;
        if (saved.version !== 1 || typeof saved.requestId !== "string" || !saved.values) throw new Error("Pending creation data is invalid; retain it and contact the operator.");
        setPending(saved);form.setFieldsValue({ ...saved.values, active: true });setReadyToConfirm(true);
        if (saved.createdId) { setSelected(saved.createdId);setNotice("The product was created. Save its association; do not create another product.");return; }
      } else { setPending(undefined);form.setFieldsValue({ productCode: initialCode, productName: "", variant: "", referenceImageUrl: initialImage, active: true }); }
      setEditor("create");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Browser storage is required for safe creation retries."); }
  }
  async function inspectDuplicates() {
    setBusy(true);setError(undefined);
    try { const values = await form.validateFields();const result = await suggestProducts(values);setSuggestions(result.suggestions);setReadyToConfirm(true); }
    catch (reason) { if (reason instanceof Error) setError(reason.message); }
    finally { setBusy(false); }
  }
  async function confirmCreate() {
    setBusy(true);setError(undefined);
    try {
      const values = pending?.values ?? await form.validateFields();
      const stored = sessionStorage.getItem(storageKey);
      const operation: PendingCreate = pending ?? (stored ? JSON.parse(stored) as PendingCreate : undefined) ?? { version: 1, requestId: crypto.randomUUID(), values: { productCode: values.productCode, productName: values.productName, variant: values.variant, referenceImageUrl: values.referenceImageUrl } };
      sessionStorage.setItem(storageKey, JSON.stringify(operation));setPending(operation);
      const result = await createProduct(operation.requestId, operation.values, suggestions.length > 0);
      const completed = { ...operation, createdId: result.product.id };sessionStorage.setItem(storageKey, JSON.stringify(completed));setPending(completed);setSelected(result.product.id);setCurrent(result.product);setEditor(undefined);
      setNotice("Product created. Save the association below. If linking fails, retry linking this product.");
    } catch (reason) {
      if (reason instanceof ProductApiError && reason.status === 401) access.invalidate();
      if (reason instanceof ProductApiError && reason.code === "duplicate_suggestions") setSuggestions(reason.suggestions ?? []);
      setError(reason instanceof Error ? reason.message : "Creation outcome is unknown. Retry the same creation request.");
    } finally { setBusy(false); }
  }
  async function checkCreation() {
    if (!pending) return;
    setBusy(true);setError(undefined);
    try {
      const result = await getProduct(`PROD-${pending.requestId}`);
      const completed = { ...pending, createdId: result.product.id };
      sessionStorage.setItem(storageKey, JSON.stringify(completed));setPending(completed);setSelected(result.product.id);setCurrent(result.product);setEditor(undefined);
      setNotice("The permanent product exists. Save its association, or explicitly keep it unlinked.");
    } catch (reason) { setError(reason instanceof ProductApiError && reason.status === 404 ? "Creation is not visible yet. This does not prove failure; retry the same creation request." : reason instanceof Error ? reason.message : "Unable to verify creation."); }
    finally { setBusy(false); }
  }
  async function stopCreation() {
    if (!pending) return;
    setBusy(true);setError(undefined);
    try {
      const result = await cancelProductCreation(pending.requestId);
      if (result.outcome === "created") {
        const completed = { ...pending, createdId: result.product.id };sessionStorage.setItem(storageKey, JSON.stringify(completed));setPending(completed);setSelected(result.product.id);setCurrent(result.product);setEditor(undefined);setNotice("Creation already completed. The product is retained; link it or explicitly finish without linking.");
      } else {
        sessionStorage.removeItem(storageKey);setPending(undefined);setEditor(undefined);setNotice("Pending creation permanently cancelled. No product was deleted.");
      }
    } catch (reason) { if (reason instanceof ProductApiError && reason.status === 401) access.invalidate();setError(reason instanceof Error ? reason.message : "Cancellation is unconfirmed. Retain this request and retry."); }
    finally { setBusy(false); }
  }
  function finishUnlinked() {
    if (!pending?.createdId) return;
    sessionStorage.removeItem(storageKey);setPending(undefined);setEditor(undefined);setSelected(linkedId);setCurrent(undefined);setNotice("The created product is retained in Product Master. No association was saved.");
  }
  async function saveLink(productId: string | null = selected) {
    setBusy(true);setError(undefined);
    try { await onSave(productId);const stored = sessionStorage.getItem(storageKey);
      if (stored && (JSON.parse(stored) as PendingCreate).createdId === productId) { sessionStorage.removeItem(storageKey);setPending(undefined); }setNotice("Product association saved."); }
    catch (reason) { if (reason && typeof reason === "object" && "status" in reason && reason.status === 401) access.invalidate();setError(reason instanceof Error ? reason.message : "Association failed. The Product Master record is retained; retry this association."); }
    finally { setBusy(false); }
  }
  function beginEdit() {
    if (!current) return;
    if (editRequest && editRequest.id !== current.id) { setError(`Resolve the pending update for ${editRequest.id} before editing another product.`);return; }
    setError(undefined);setEditor("edit");form.setFieldsValue(editRequest?.values ?? current);
  }
  async function saveEdit() {
    if (!current) return;
    setBusy(true);setError(undefined);
    try {
      const fields = await form.validateFields();
      const values: ProductEdit = { productCode: fields.productCode, productName: fields.productName, variant: fields.variant, referenceImageUrl: fields.referenceImageUrl, active: fields.active };
      const operation = editRequest ?? { id: current.id, values, revision: current.updatedAt, requestId: crypto.randomUUID() };setEditRequest(operation);
      const result = await editProduct(operation.id, operation.requestId, operation.revision, operation.values);setCurrent(result.product);setEditRequest(undefined);setEditor(undefined);setNotice(result.product.active ? "Product updated." : "Product archived. Existing Orders and associations are retained.");setQuery(result.product.productCode);
    } catch (reason) { if (reason instanceof ProductApiError && reason.status === 401) access.invalidate();setError(reason instanceof Error ? reason.message : "Edit outcome is unknown. Retry the same edit."); }
    finally { setBusy(false); }
  }
  async function reloadEdit() {
    if (!current) return;
    setBusy(true);
    try { const result = await getProduct(current.id);setCurrent(result.product);setEditRequest(undefined);form.setFieldsValue(result.product);setError(undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to reload product."); }
    finally { setBusy(false); }
  }
  return <Space orientation="vertical" style={{ width: "100%", minWidth: 0, overflowWrap: "anywhere" }}>
    <ProductStaffAccess access={access} contextKey={contextKey} />
    <Tag color={linkedId ? "green" : "default"}>{linkedId ? "Linked" : "Unlinked"}</Tag>
    {error && !editor ? <Alert type="error" title={error} showIcon /> : null}
    {editRequest && editRequest.id !== selected ? <Button disabled={busy} onClick={() => { setSelected(editRequest.id);setCurrent(undefined);setNotice("Pending product selected. Reopen Edit to retry or review its current state."); }} title={editRequest.id}>Resume pending product update</Button> : null}
    {notice ? <Alert type="info" title={notice} showIcon /> : null}
    {pending?.createdId ? <Button disabled={busy} onClick={finishUnlinked}>Keep created product unlinked and finish this creation</Button> : null}
    <label htmlFor={`product-search-${contextKey}`}>Search Product Master</label>
    <Select id={`product-search-${contextKey}`} aria-label="Search Product Master" showSearch={{ onSearch: setQuery, filterOption: false }} allowClear style={{ width: "100%" }} value={selected ?? undefined} onChange={value => { setSelected(value ?? null);setCurrent(undefined); }} options={options.map(product => ({ value: product.id, label: `${product.productCode || "No code"} · ${product.productName} · ${product.variant || "No variant"} · ${product.id}${product.active ? "" : " (archived)"}`, disabled: !product.active && product.id !== linkedId }))} />
    {current ? <Typography.Text>{current.productName} — {current.variant || "No variant"} {current.active ? "" : "(archived)"}</Typography.Text> : selected ? <Typography.Text>Product ID: {selected}</Typography.Text> : null}
    <Space wrap>
      <Button type="primary" loading={busy} disabled={!access.staff} onClick={() => void saveLink()}>Save association</Button>
      {linkedId ? <Button danger disabled={busy || !access.staff} onClick={() => void saveLink(null)}>Remove association</Button> : null}
      <Button disabled={busy || !access.staff} onClick={() => void beginCreate()}>Create new product</Button>
      <Button disabled={busy || !current || !access.staff} onClick={beginEdit}>Edit / archive product</Button>
    </Space>
    <Typography.Text type="secondary">Clear the selection and save to remove an incorrect association. Creating or archiving a product does not change Order quantities, photos or codes.</Typography.Text>
    <Modal open={Boolean(editor)} title={editor === "create" ? "Create Product Master record" : "Edit Product Master record"} onCancel={() => { if (!busy) setEditor(undefined); }} footer={null} forceRender styles={{ body: { overflowWrap: "anywhere" } }}>
      {error ? <Alert type="error" title={error} showIcon /> : null}
      {editor === "edit" && editRequest ? <><Alert type="info" title="An earlier update may still finish. Reload current data and review it before starting a different update." /><Button disabled={busy} onClick={() => void reloadEdit()}>Reload current product and review again</Button></> : null}
      <Form name={`product-master-${contextKey}`} form={form} layout="vertical" disabled={busy || (editor === "create" ? Boolean(pending) : Boolean(editRequest))} onValuesChange={() => { setReadyToConfirm(false);setSuggestions([]); }}>
        <Form.Item name="productCode" label="Product code" rules={[{ max: 100 }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="productName" label="Product name" rules={[{ required: true, whitespace: true }, { max: 200 }]}><Input maxLength={200} /></Form.Item>
        <Form.Item name="variant" label="Variant" rules={[{ max: 200 }]}><Input maxLength={200} /></Form.Item>
        <Form.Item name="referenceImageUrl" label="Reference image URL" rules={[{ max: 2048 }]}><Input maxLength={2048} /></Form.Item>
        {editor === "edit" ? <Form.Item name="active" valuePropName="checked"><Checkbox>Active (uncheck to archive; historical Orders remain)</Checkbox></Form.Item> : null}
      </Form>
      {suggestions.length ? <Alert type="warning" title="Possible duplicate products" description={<ul>{suggestions.map(({ product, reasons }) => <li key={product.id}>{product.productCode} · {product.productName} · {product.variant} ({reasons.join(", ")}){product.active ? "" : " — archived"}</li>)}</ul>} /> : null}
      <Divider />
      {editor === "create" ? <Space orientation="vertical">
        {pending && !pending.createdId ? <Space wrap><Button disabled={busy} onClick={() => void checkCreation()}>Check whether this creation completed</Button><Button danger disabled={busy || !access.staff} onClick={() => Modal.confirm({ title: "Permanently stop this pending creation?", content: "If it already completed, the product will be retained. No historical data will be deleted.", onOk: stopCreation })}>Cancel pending creation safely</Button></Space> : null}
        <Typography.Text>No product is created until you explicitly confirm below. Product codes can be shared by different products.</Typography.Text>
        {!readyToConfirm ? <Button loading={busy} onClick={() => void inspectDuplicates()}>Review duplicate suggestions</Button> : <Button type="primary" loading={busy} disabled={!access.staff} onClick={() => void confirmCreate()}>{pending ? "Retry same creation request" : suggestions.length ? "Confirm creation despite suggestions" : "Confirm product creation"}</Button>}
      </Space> : <Button type="primary" loading={busy} disabled={!access.staff} onClick={() => void saveEdit()}>{editRequest ? "Retry same product update" : "Confirm product update"}</Button>}
    </Modal>
  </Space>;
}
