import { NextResponse } from "next/server";
import { getConfig } from "@/config";
import { createGoogleSheetsServiceFromConfig } from "@/externals/google/sheet";
import { updateEmployee } from "@/services/employees";
import { parseEmployeeInput } from "../route";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const employeeId = (await params).id.trim();
  const input = parseEmployeeInput(await readJsonBody(request), true);
  if (!employeeId || !input || Object.keys(input).length === 0) {
    return NextResponse.json(
      { ok: false, error: "Enter valid employee changes." },
      { status: 400 },
    );
  }

  try {
    const employee = await updateEmployee({
      employeeId,
      googleSheetsService: createGoogleSheetsServiceFromConfig(getConfig()),
      input,
    });
    if (!employee) {
      return NextResponse.json(
        { ok: false, error: "Employee not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, employee });
  } catch (error) {
    console.error("Failed to update employee", {
      employeeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to update employee." },
      { status: 500 },
    );
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
