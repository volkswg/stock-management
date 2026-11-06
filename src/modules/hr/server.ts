import "server-only";
import type { IGoogleSheetsService } from "@/externals/google/sheet/types";
import type { EmployeeDirectoryEntry } from "./contracts";
import { GoogleSheetsEmployeeDirectoryReader } from "./infrastructure/google-sheets/employee-directory-reader";

export function readEmployeeDirectory({ googleSheetsService, unavailableError }: {
  googleSheetsService: IGoogleSheetsService;
  unavailableError: () => Error;
}): Promise<EmployeeDirectoryEntry[]> {
  return new GoogleSheetsEmployeeDirectoryReader(googleSheetsService, unavailableError).listEmployees();
}
