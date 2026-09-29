import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { isRecord } from "@/features/backend/shared/utils";
import { createEmployee, listEmployees } from "@/services/employees";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const employees = await listEmployees({
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
    });
    return NextResponse.json({ ok: true, employees });
  } catch (error) {
    console.error("Failed to list employees", { error: getErrorMessage(error) });
    return NextResponse.json(
      { ok: false, error: "Failed to load employees." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const input = parseEmployeeInput(await readJsonBody(request), false);
  if (!input || !input.name || !input.hiredDate || !input.status) {
    return NextResponse.json(
      { ok: false, error: "Enter valid employee details." },
      { status: 400 },
    );
  }

  try {
    const employee = await createEmployee({
      createdBy: "web",
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
      input: {
        name: input.name,
        phone: input.phone || "",
        status: input.status,
        hiredDate: input.hiredDate,
        terminatedDate: input.terminatedDate || "",
        baseSalary: input.baseSalary ?? 0,
        commission: input.commission ?? 0,
        compensationEffectiveFrom:
          input.compensationEffectiveFrom || input.hiredDate,
        compensationType: input.compensationType || "monthly",
      },
    });
    return NextResponse.json({ ok: true, employee }, { status: 201 });
  } catch (error) {
    console.error("Failed to create employee", { error: getErrorMessage(error) });
    return NextResponse.json(
      { ok: false, error: "Failed to create employee." },
      { status: 500 },
    );
  }
}

export function parseEmployeeInput(
  value: unknown,
  partial: boolean,
): {
  name?: string;
  phone?: string;
  status?: "active" | "inactive";
  hiredDate?: string;
  terminatedDate?: string;
  baseSalary?: number;
  commission?: number;
  compensationEffectiveFrom?: string;
  compensationType?: "daily" | "monthly";
} | null {
  if (!isRecord(value)) return null;
  const name = readOptionalString(value.name, 100);
  const phone = readOptionalString(value.phone, 30);
  const hiredDate = readOptionalDate(value.hiredDate);
  const terminatedDate = readOptionalDate(value.terminatedDate, true);
  const baseSalary = readOptionalMoney(value.baseSalary);
  const commission = readOptionalMoney(value.commission);
  const compensationEffectiveFrom = readOptionalDate(
    value.compensationEffectiveFrom,
  );
  const compensationType = value.compensationType;
  const status = value.status;
  if (
    name === null ||
    name === "" ||
    phone === null ||
    hiredDate === null ||
    terminatedDate === null ||
    baseSalary === null ||
    commission === null ||
    compensationEffectiveFrom === null ||
    (compensationEffectiveFrom !== undefined &&
      compensationEffectiveFrom > getBangkokDate()) ||
    (compensationType !== undefined &&
      compensationType !== "daily" &&
      compensationType !== "monthly") ||
    (status !== undefined && status !== "active" && status !== "inactive") ||
    (!partial && (name === undefined || hiredDate === undefined))
  ) {
    return null;
  }
  const result: {
    name?: string;
    phone?: string;
    status?: "active" | "inactive";
    hiredDate?: string;
    terminatedDate?: string;
    baseSalary?: number;
    commission?: number;
    compensationEffectiveFrom?: string;
    compensationType?: "daily" | "monthly";
  } = {};
  if (name !== undefined) result.name = name;
  if (phone !== undefined) result.phone = phone;
  if (hiredDate !== undefined) result.hiredDate = hiredDate;
  if (terminatedDate !== undefined) result.terminatedDate = terminatedDate;
  if (baseSalary !== undefined) result.baseSalary = baseSalary;
  if (commission !== undefined) result.commission = commission;
  if (compensationEffectiveFrom !== undefined) {
    result.compensationEffectiveFrom = compensationEffectiveFrom;
  }
  if (compensationType === "daily" || compensationType === "monthly") {
    result.compensationType = compensationType;
  }
  if (status === "active" || status === "inactive") result.status = status;
  return result;
}

function readOptionalMoney(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1_000_000_000) return null;
  return Math.round(value * 100) / 100;
}

function getBangkokDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function readOptionalString(
  value: unknown,
  maxLength: number,
): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length <= maxLength ? result : null;
}

function readOptionalDate(
  value: unknown,
  allowEmpty = false,
): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const result = value.trim();
  if (allowEmpty && !result) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return null;
  const [year, month, day] = result.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? result
    : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
