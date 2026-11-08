"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Form, Input, Space, Typography } from "antd";
export function useProductStaffAccess() {
  const [staff, setStaff] = useState<string>(), [enabled, setEnabled] = useState(false), [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/product-access", { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();if (!response.ok) throw new Error(body.error ?? "Staff access is unavailable.");
      if (!controller.signal.aborted) { setStaff(body.staff?.id);setEnabled(body.enabled); }
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Staff access is unavailable."); });
    return () => controller.abort();
  }, []);
  return { staff, enabled, error, invalidate: () => setStaff(undefined), async login(staffId: string, accessKey: string) {
    setError(undefined);const response = await fetch("/api/product-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId, accessKey }) });const body = await response.json();if (!response.ok) throw new Error(body.error ?? "Staff sign-in failed.");setStaff(body.staff.id);
  }, async logout() {
    const response = await fetch("/api/product-access", { method: "DELETE" });if (!response.ok) throw new Error("Sign-out failed.");setStaff(undefined);
  } };
}
export function ProductStaffAccess({ access, contextKey }: { contextKey: string;access: ReturnType<typeof useProductStaffAccess> }) {
  const [error, setError] = useState<string>(), [busy, setBusy] = useState(false), [form] = Form.useForm<{ staffId: string; accessKey: string }>();
  async function login() {
    setBusy(true);setError(undefined);
    try { const values = await form.validateFields();form.setFieldValue("accessKey", "");await access.login(values.staffId, values.accessKey); }
    catch (reason) { if (reason instanceof Error) setError(reason.message); }
    finally { setBusy(false); }
  }
  return <Space orientation="vertical" style={{ width: "100%" }}>
    {access.error || error ? <Alert type="error" title={error ?? access.error} /> : null}
    {access.staff ? <Space wrap style={{ width: "100%" }}><Typography.Text style={{ overflowWrap: "anywhere" }}>Product editor: {access.staff}</Typography.Text><Button size="small" disabled={busy} onClick={() => { setBusy(true);void access.logout().catch(reason => setError(reason instanceof Error ? reason.message : "Sign-out failed.")).finally(() => setBusy(false)); }}>Sign out</Button></Space> : access.enabled ? <>
      <Typography.Text>Staff sign-in is required to create, edit, archive or link products.</Typography.Text>
      <Form name={`product-staff-${contextKey}`} form={form} layout="vertical" onFinish={() => void login()} disabled={busy} autoComplete="off">
        <Form.Item name="staffId" label="Staff ID" rules={[{ required: true }, { max: 64 }]}><Input autoComplete="username" maxLength={64} /></Form.Item>
        <Form.Item name="accessKey" label="Staff access key" rules={[{ required: true }, { len: 43 }]}><Input.Password autoComplete="off" maxLength={43} /></Form.Item>
        <Button htmlType="submit" loading={busy}>Sign in for product changes</Button>
      </Form>
    </> : <Alert type="info" title="Product editing is disabled until the owner configures staff access. Product search and existing Order operations remain available." />}
  </Space>;
}
