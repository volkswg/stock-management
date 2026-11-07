export class ExpenseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
