import type { Expense, ExpenseCategory, ExpenseShop, ExpenseInput } from '../src/modules/expenses/contracts';
import type { Expense as LegacyExpense, ExpenseCategory as LegacyCategory, ExpenseShop as LegacyShop, ExpenseInput as LegacyInput } from '../src/services/expenses/types';
import type { ExpenseReader, ExpenseMastersReader, ExpenseRuntime } from '../src/modules/expenses/application/ports/expense-store';
import type { SalaryAdvanceShops } from '../src/modules/hr/application/ports/salary-advance-shops';
import { listExpenses } from '../src/modules/expenses/application/manage-expenses';
import { saveExpense } from '../src/modules/expenses/server';
import { saveExpense as legacySave } from '../src/services/expenses';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
const exact: [Equal<Expense,LegacyExpense>,Equal<ExpenseCategory,LegacyCategory>,Equal<ExpenseShop,LegacyShop>,Equal<ExpenseInput,LegacyInput>] = [true,true,true,true];
export const callable: typeof saveExpense = legacySave;
export function expensePorts(reader: ExpenseReader & ExpenseMastersReader, runtime: ExpenseRuntime, shops: SalaryAdvanceShops) {
  return { list: listExpenses({store:reader,year:'2026'}), now:runtime.now, shops:shops.listShops(), exact };
}
