import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import type { SalaryAdvanceShops } from "@/modules/hr/application/ports/salary-advance-shops";
import { listExpenseShops } from "@/modules/expenses/server";

// Legacy compatibility composition stays outside both feature cores.
export function createSalaryAdvanceShops(service: IGoogleSheetsService): SalaryAdvanceShops {
  return { listShops: () => listExpenseShops(service) };
}
