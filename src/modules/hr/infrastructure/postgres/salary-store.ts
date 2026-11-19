import "server-only";
import type { SalaryAdvance, PayrollSettlement } from "../../contracts";
import { str } from "../../domain/salary-rules";
import type { SalaryStore, SettlementEntry } from "../../application/ports/payroll";
import type { Storage } from "./storage";
export class PostgresSalaryStore implements SalaryStore {
  constructor(private readonly storage: Pick<Storage, "employeeAdvances" | "payrollSettlements">) {}
  async readAdvances(): Promise<SalaryAdvance[]> {
    return (await this.storage.employeeAdvances.all()).filter(r => r.id).map(r => ({
      id: str(r.id), employeeId: str(r.employeeId), shopId: str(r.shopId), requestedDate: str(r.requestedDate), payrollMonth: str(r.payrollMonth), requestedAmount: Number(r.requestedAmount), paidAmount: Number(r.paidAmount), status: str(r.status) as SalaryAdvance["status"], paidDate: str(r.paidDate), reference: str(r.reference), note: str(r.note), createdAt: str(r.createdAt), updatedAt: str(r.updatedAt),
    }));
  }
  async readSettlements(): Promise<SettlementEntry[]> {
    return (await this.storage.payrollSettlements.all()).filter(r => r.id).map(r => ({ get id() { return str(r.id); }, get employeeId() { return str(r.employeeId); }, get month() { return str(r.month); }, get paidDate() { return str(r.paidDate); }, get reference() { return str(r.reference); }, get createdAt() { return str(r.createdAt); }, get snapshotText() { return str(r.snapshot); } }));
  }
  prepareAdvances() { return this.storage.employeeAdvances.prepare(); }
  prepareSettlements() { return this.storage.payrollSettlements.prepare(); }
  appendAdvance(value: SalaryAdvance) { return this.storage.employeeAdvances.insert(advanceRecord(value)); }
  async updateAdvanceCopies(id: string, next: SalaryAdvance) {
    for (const record of await this.storage.employeeAdvances.all()) if (str(record.id) === id) await this.storage.employeeAdvances.update(record, advanceRecord(next));
  }
  appendSettlement(read: () => PayrollSettlement, snapshotJson: string) {
    const value = read(); return this.storage.payrollSettlements.insert({ id: value.id, employeeId: value.employeeId, month: value.month, paidDate: value.paidDate, reference: value.reference, createdAt: value.createdAt, snapshot: snapshotJson });
  }
}
function advanceRecord(value: SalaryAdvance) { return { id: value.id, employeeId: value.employeeId, shopId: value.shopId, requestedDate: value.requestedDate, payrollMonth: value.payrollMonth, requestedAmount: value.requestedAmount, paidAmount: value.paidAmount, status: value.status, paidDate: value.paidDate, reference: value.reference, note: value.note, createdAt: value.createdAt, updatedAt: value.updatedAt }; }

export type SalaryStorage = Storage;
