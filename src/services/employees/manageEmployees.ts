import { listEmployees as ownedList, listEmployeeCompensations as ownedCompensations, createEmployee as ownedCreate, updateEmployee as ownedUpdate } from "@/modules/hr/server";
export type { EmployeeStatus, EmployeeCompensationType, EmployeeCommissionType, Employee, EmployeeCompensation, EmployeeInput } from "@/modules/hr/contracts";
// Semantic aliases preserve the module function identities.
export const listEmployees = ownedList;
export const listEmployeeCompensations = ownedCompensations;
export const createEmployee = ownedCreate;
export const updateEmployee = ownedUpdate;
