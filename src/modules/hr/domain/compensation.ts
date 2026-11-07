import type { EmployeeCompensation } from "../contracts";

export function currentCompensationsByEmployeeId(
  entries: Iterable<EmployeeCompensation | null>,
  today: string,
): Map<string, EmployeeCompensation> {
  const current = new Map<string, EmployeeCompensation>();
  for (const compensation of entries) {
    if (!compensation || compensation.effectiveFrom > today) continue;
    const existing = current.get(compensation.employeeId);
    if (
      !existing ||
      compensation.effectiveFrom > existing.effectiveFrom ||
      (compensation.effectiveFrom === existing.effectiveFrom &&
        compensation.createdAt > existing.createdAt)
    ) {
      current.set(compensation.employeeId, compensation);
    }
  }
  return current;
}

