import "server-only";
import type { BusinessDatabase as Storage } from "@/composition/postgres/service";
import type { SalaryAdvanceShops } from "@/modules/hr/application/ports/salary-advance-shops";
import { listExpenseShops } from "@/modules/expenses/server";

// Cross-feature reader composition stays outside both feature cores.
export function createSalaryAdvanceShops(service: Storage): SalaryAdvanceShops {
  return { listShops: () => listExpenseShops(service) };
}
