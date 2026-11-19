import "server-only";
import type { EmployeeDirectoryEntry } from "../../contracts";
import type { Storage } from "./storage";
export class PostgresEmployeeDirectoryReader {
  constructor(private readonly storage: Pick<Storage, "employees">, private readonly unavailableError: () => Error) {}
  async listEmployees(): Promise<EmployeeDirectoryEntry[]> {
    const records = await this.storage.employees.all();
    return records.filter(r => r.id).map(r => ({ id: text(r.id), name: text(r.name), status: text(r.status), hiredDate: text(r.hiredDate), terminatedDate: text(r.terminatedDate) }));
  }
}
const text = (value: unknown) => String(value ?? "");
