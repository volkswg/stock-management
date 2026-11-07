import "server-only";
import type { WorkflowRuntime } from "../application/ports/workflows";
export function createWorkflowRuntime(createId: () => string): WorkflowRuntime { return { createId, now: () => new Date().toISOString(), eventTime: readTimestamp => new Date(readTimestamp() || Date.now()).toISOString(), error: (label, readDetails) => console.error(label, readDetails()), received: readDetails => console.log('LINE webhook received', readDetails()) }; }
