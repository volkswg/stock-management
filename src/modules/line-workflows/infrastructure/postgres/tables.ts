import "server-only";
import { PostgresRecords } from "@/infrastructure/persistence/postgres/records";
import { USER_STATE_SHEET_HEADERS } from "@/modules/line-workflows/infrastructure/google-sheets/user-state/const";

export function line_workflowsTables() {
  return {
    userState: new PostgresRecords({ table: "user_state", headers: USER_STATE_SHEET_HEADERS, clearAsArchive: true }),
  };
}
