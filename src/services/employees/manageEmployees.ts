import type { IGoogleSheetsService } from "@/infrastructure/persistence/google-sheets/service-contracts";
import type { Employee, EmployeeCompensation, EmployeeInput } from "@/modules/hr/contracts";
import { listEmployees as ownedList, listEmployeeCompensations as ownedCompensations, createEmployee as ownedCreate, updateEmployee as ownedUpdate } from "@/modules/hr/server";
export type { EmployeeStatus, EmployeeCompensationType, EmployeeCommissionType, Employee, EmployeeCompensation, EmployeeInput } from "@/modules/hr/contracts";
// Typed aliases retain the original full-service callable contract and identity.
export const listEmployees: (input: { googleSheetsService: IGoogleSheetsService }) => Promise<Employee[]> = ownedList;
export const listEmployeeCompensations: (input: { googleSheetsService: IGoogleSheetsService }) => Promise<EmployeeCompensation[]> = ownedCompensations;
export const createEmployee: (input: { createdBy: string; googleSheetsService: IGoogleSheetsService; input: EmployeeInput }) => Promise<Employee> = ownedCreate;
export const updateEmployee: (input: { employeeId: string; googleSheetsService: IGoogleSheetsService; input: Partial<EmployeeInput> }) => Promise<Employee | null> = ownedUpdate;
