import "server-only";
import { NativeRecords } from "@/infrastructure/persistence/postgres/native-records";

export function line_workflowsTables() {
  return {
    userState: new NativeRecords("user_state", {
      id: { column: "id", kind: "text", textOnly: true },
      userId: { column: "userId", kind: "text", textOnly: true },
      flowname: { column: "flowname", kind: "text", textOnly: true },
      referenceId: { column: "referenceId", kind: "text", textOnly: true },
      state: { column: "state", kind: "text", textOnly: true },
      createdAt: { column: "createdAt", kind: "timestamp" },
      updatedAt: { column: "updatedAt", kind: "timestamp" },
      context: { column: "context", kind: "jsonb" },
    } as const),
  };
}
