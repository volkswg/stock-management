import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import { EMPLOYEE_HEADERS } from "@/externals/google/sheet/sheets/employees/const";
import type { EmployeeDirectoryEntry } from "../../contracts";

export class GoogleSheetsEmployeeDirectoryReader {
  constructor(
    private readonly service: Pick<IGoogleSheetsService, "employees">,
    private readonly unavailableError: () => Error,
  ) {}

  async listEmployees(): Promise<EmployeeDirectoryEntry[]> {
    const rows = await this.service.employees.readRows();
    if (!rows.length) return [];
    if (rows[0]?.slice(0, EMPLOYEE_HEADERS.length).join("|") !== EMPLOYEE_HEADERS.join("|")) throw this.unavailableError();
    return rows.slice(1).filter(r => r[0]).map(r => ({ id: text(r[0]), name: text(r[1]), status: text(r[3]), hiredDate: text(r[4]), terminatedDate: text(r[5]) }));
  }
}

const text = (v: unknown) => String(v ?? "");
