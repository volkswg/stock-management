import "server-only";
import { projectLineWebhookPayload } from "../domain/payload";
import type { LineWebhookPayload } from "@/shared/types/line-protocol";
export const parseLineWebhookPayload = (rawBody: Buffer): LineWebhookPayload => { const payload = JSON.parse(rawBody.toString('utf8')) as unknown; return projectLineWebhookPayload(payload); };
