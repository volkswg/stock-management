import type { Employee, EmployeeInput, EmployeeCompensation, EmployeeCompensationType, EmployeeCommissionType } from "../contracts";
import type { EmployeeStore, WorkforceRuntime } from "./ports/workforce";
import { currentCompensationsByEmployeeId } from "../domain/compensation";

export async function listEmployees({
  store,
}: {
  store: EmployeeStore;
}, runtime: WorkforceRuntime): Promise<Employee[]> {
  await store.prepareCompensations();
  const [rows, compensationRows] = await Promise.all([
    store.readEmployees(),
    store.readCompensations(),
  ]);
  const compensationByEmployeeId = currentCompensationsByEmployeeId(
    compensationRows.entries(), runtime.today(),
  );
  return rows.list()
    .map((employee) => ({
      ...employee,
      compensation: compensationByEmployeeId.get(employee.id) || null,
    }))
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "active" ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

export async function listEmployeeCompensations({
  store,
}: {
  store: EmployeeStore;
}): Promise<EmployeeCompensation[]> {
  await store.prepareCompensations();
  const rows = await store.readCompensations();
  return rows.list()
    .sort((left, right) =>
      left.effectiveFrom === right.effectiveFrom
        ? left.createdAt.localeCompare(right.createdAt)
        : left.effectiveFrom.localeCompare(right.effectiveFrom),
    );
}

export async function createEmployee({
  createdBy,
  store,
  input,
}: {
  createdBy: string;
  store: EmployeeStore;
  input: EmployeeInput;
}, runtime: WorkforceRuntime): Promise<Employee> {
  await store.prepareEmployees();
  const now = runtime.now();
  const employee: Employee = {
    id: `EMP-${runtime.createId()}`,
    name: input.name,
    phone: input.phone,
    status: input.status,
    hiredDate: input.hiredDate,
    terminatedDate: input.status === "active" ? "" : input.terminatedDate,
    createdAt: now,
    updatedAt: now,
    createdBy,
    compensation: null,
  };
  await store.appendEmployee(employee);
  const compensation = await appendEmployeeCompensation({
    employeeId: employee.id,
    baseSalary: input.baseSalary,
    commission: input.commission,
    effectiveFrom: input.compensationEffectiveFrom,
    compensationType: input.compensationType,
    commissionType: input.commissionType,
    commissionBucketSales: input.commissionBucketSales,
    commissionBucketAmount: input.commissionBucketAmount,
    commissionRoundupThreshold: input.commissionRoundupThreshold,
    store,
    updatedBy: createdBy,
  }, runtime);
  return { ...employee, compensation };
}

export async function updateEmployee({
  employeeId,
  store,
  input,
}: {
  employeeId: string;
  store: EmployeeStore;
  input: Partial<EmployeeInput>;
}, runtime: WorkforceRuntime): Promise<Employee | null> {
  const rows = await store.readEmployees();
  const reference = rows.find(employeeId);
  if (!reference) return null;

  const current = reference.read();
  if (!current) return null;
  const status = input.status ?? current.status;
  const {
    baseSalary,
    commission,
    compensationEffectiveFrom,
    compensationType,
    commissionType,
    commissionBucketSales,
    commissionBucketAmount,
    commissionRoundupThreshold,
    ...employeeInput
  } = input;
  const employee: Employee = {
    ...current,
    ...employeeInput,
    status,
    terminatedDate:
      status === "active"
        ? ""
        : input.terminatedDate || current.terminatedDate || runtime.today(),
    updatedAt: runtime.now(),
  };
  await store.updateEmployee(reference, employee);
  if (
    baseSalary === undefined &&
    commission === undefined &&
    compensationType === undefined &&
    commissionType === undefined &&
    commissionBucketSales === undefined &&
    commissionBucketAmount === undefined &&
    commissionRoundupThreshold === undefined
  ) {
    return employee;
  }
  await store.prepareCompensations();
  const compensationRows =
    await store.readCompensations();
  const currentCompensation =
    currentCompensationsByEmployeeId(compensationRows.entries(), runtime.today()).get(employeeId) || null;
  const nextBaseSalary = baseSalary ?? currentCompensation?.baseSalary ?? 0;
  const nextCommission = commission ?? currentCompensation?.commission ?? 0;
  const nextCompensationType =
    compensationType ?? currentCompensation?.compensationType ?? "monthly";
  const nextCommissionType =
    commissionType ?? currentCompensation?.commissionType ?? "none";
  const currentBucketSales =
    currentCompensation?.commissionType === "sales_bucket" &&
    currentCompensation.commissionBucketSales > 0
      ? currentCompensation.commissionBucketSales
      : 10_000;
  const nextCommissionBucketSales =
    nextCommissionType === "sales_bucket"
      ? commissionBucketSales ?? currentBucketSales
      : 0;
  const currentBucketAmount =
    currentCompensation?.commissionType === "sales_bucket" &&
    currentCompensation.commissionBucketAmount > 0
      ? currentCompensation.commissionBucketAmount
      : 70;
  const nextCommissionBucketAmount =
    nextCommissionType === "sales_bucket"
      ? commissionBucketAmount ?? currentBucketAmount
      : 0;
  const currentRoundupThreshold =
    currentCompensation?.commissionType === "sales_bucket" &&
    currentCompensation.commissionRoundupThreshold > 0
      ? currentCompensation.commissionRoundupThreshold
      : 8_000;
  const nextCommissionRoundupThreshold =
    nextCommissionType === "sales_bucket"
      ? commissionRoundupThreshold ?? currentRoundupThreshold
      : 0;
  if (
    currentCompensation &&
    nextBaseSalary === currentCompensation.baseSalary &&
    nextCommission === currentCompensation.commission &&
    nextCompensationType === currentCompensation.compensationType &&
    nextCommissionType === currentCompensation.commissionType &&
    nextCommissionBucketSales === currentCompensation.commissionBucketSales &&
    nextCommissionBucketAmount === currentCompensation.commissionBucketAmount &&
    nextCommissionRoundupThreshold ===
      currentCompensation.commissionRoundupThreshold
  ) {
    return { ...employee, compensation: currentCompensation };
  }
  const compensation = await appendEmployeeCompensation({
    employeeId,
    baseSalary: nextBaseSalary,
    commission: nextCommission,
    effectiveFrom: compensationEffectiveFrom || runtime.today(),
    compensationType: nextCompensationType,
    commissionType: nextCommissionType,
    commissionBucketSales: nextCommissionBucketSales,
    commissionBucketAmount: nextCommissionBucketAmount,
    commissionRoundupThreshold: nextCommissionRoundupThreshold,
    store,
    updatedBy: "web",
  }, runtime);
  return { ...employee, compensation };
}

async function appendEmployeeCompensation({
  employeeId,
  baseSalary,
  commission,
  effectiveFrom,
  compensationType,
  commissionType,
  commissionBucketSales,
  commissionBucketAmount,
  commissionRoundupThreshold,
  store,
  updatedBy,
}: {
  employeeId: string;
  baseSalary: number;
  commission: number;
  effectiveFrom: string;
  compensationType: EmployeeCompensationType;
  commissionType: EmployeeCommissionType;
  commissionBucketSales: number;
  commissionBucketAmount: number;
  commissionRoundupThreshold: number;
  store: EmployeeStore;
  updatedBy: string;
}, runtime: WorkforceRuntime): Promise<EmployeeCompensation> {
  await store.prepareCompensations();
  const now = runtime.now();
  const compensation: EmployeeCompensation = {
    employeeId,
    baseSalary,
    commission,
    createdAt: now,
    updatedAt: now,
    updatedBy,
    effectiveFrom,
    compensationType,
    commissionType,
    commissionBucketSales,
    commissionBucketAmount,
    commissionRoundupThreshold,
  };
  await store.appendCompensation(compensation);
  return compensation;
}

