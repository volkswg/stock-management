import "server-only";
import { currentTransaction, requireMutation, PersistenceFailure } from "./database";
import type { GoogleSheetRow, GoogleSheetRangeUpdate } from "../google-sheets/types";

export type TableDefinition = { table: string; headers: readonly string[]; key?: string; clearAsArchive?: boolean };
function bounds(range: string, width: number, length: number) {
  const normalized = /^([A-Z]+)(\d+)$/.test(range) ? `${range}:${range}` : range;
  const match = /^([A-Z]+)(\d*)?:([A-Z]+)(\d*)?$/.exec(normalized);
  if (!match) throw new PersistenceFailure(503, "Unsupported record projection.");
  const column = (value: string) => [...value].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  return { x: column(match[1]), y: column(match[3]) + 1, start: Number(match[2] || 1) - 1, end: match[4] ? Number(match[4]) : length, width };
}
// Compatibility projection only: business applications still consume their existing
// feature-owned ports/mappers. All storage is in typed operational tables, and the
// entire command runs in a single explicit unit of work (never per-cell commits).
export class PostgresRecords {
  readonly table: string;
  constructor(readonly definition: TableDefinition) {
    if (!/^[a-z_]+$/.test(definition.table) || definition.headers.some(h => !/^[a-zA-Z_]+$/.test(h))) throw new PersistenceFailure();
    this.table = `stock_operational.${definition.table}`;
  }
  async ensureExists() { await currentTransaction().query(`SELECT 1 FROM ${this.table} LIMIT 0`); }
  async checkConnection() { await this.ensureExists(); }
  private async rows() {
    return (await currentTransaction().query<{ row_order: string; business_cells: GoogleSheetRow; revision: string; archived_at: string | null }>(
      `SELECT row_order,stock_operational.project_${this.definition.table}(t) AS business_cells,revision,archived_at FROM ${this.table} t ORDER BY row_order`)).rows;
  }
  async readRows(range = "A:ZZ"): Promise<GoogleSheetRow[]> {
    const stored = await this.rows(), rows: GoogleSheetRow[] = [[...this.definition.headers]];
    for (const record of stored) {
      const ordinal=Number(record.row_order);
      if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 1_000_000) throw new PersistenceFailure(503,"Record projection exceeds the validated staging capacity.");
      while (rows.length <= ordinal) rows.push([]);
      rows[ordinal]=record.archived_at ? [] : record.business_cells;
    }
    const b = bounds(range, this.definition.headers.length, rows.length);
    return rows.slice(b.start, b.end).map(row => row.slice(b.x, b.y));
  }
  private async columns(): Promise<string[]> {
    const result = await currentTransaction().query<{column_name: string}>(`SELECT column_name FROM information_schema.columns WHERE table_schema='stock_operational' AND table_name=$1 ORDER BY ordinal_position`, [this.definition.table]);
    return result.rows.map(r => r.column_name).filter(c => this.definition.headers.includes(c) || c === 'cell_kinds' || (c.endsWith('__lexeme') && this.definition.headers.includes(c.slice(0,-8))));
  }
  private async insert(cells: GoogleSheetRow) {
    const client = requireMutation(), key = this.definition.key || "id";
    if (cells.length > this.definition.headers.length || !cells.length) throw new PersistenceFailure(409, "Invalid record width.");
    const id = key === "migration_id" ? undefined : cells[this.definition.headers.indexOf(key)];
    if (key !== "migration_id" && (typeof id !== "string" || !id)) throw new PersistenceFailure(409, "Business identity is required.");
    const columns = await this.columns();
    const names = columns.map(c => `"${c}"`).join(',');
    await client.query(`INSERT INTO ${this.table}(${key === "migration_id" ? 'migration_id,' : ''}${names},row_order) SELECT ${key === "migration_id" ? "'COMP-'||gen_random_uuid()::text," : ''}${columns.map(c => `i."${c}"`).join(',')},(SELECT coalesce(max(row_order),0)+1 FROM ${this.table}) FROM stock_operational.input_${this.definition.table}($1::jsonb) i`, [JSON.stringify(cells)]);
  }
  async appendRows(_range: string, values: GoogleSheetRow[]) { for (const row of values) await this.insert(row); }
  async updateRows(range: string, values: GoogleSheetRow[]) {
    const client = requireMutation(), stored = await this.rows();
    const b = bounds(range, this.definition.headers.length, stored.length + 1);
    for (const [offset, patch] of values.entries()) {
      const rowIndex = b.start + offset;
      if (rowIndex === 0) {
        if (JSON.stringify(patch) !== JSON.stringify(this.definition.headers.slice(b.x,b.x+patch.length))) throw new PersistenceFailure(409, "Schema headers cannot be changed.");
        continue;
      }
      const old = stored.find(row=>Number(row.row_order)===rowIndex && !row.archived_at);
      if (!old) throw new PersistenceFailure(409, "Record no longer exists.");
      const next = [...old.business_cells];
      while (next.length < this.definition.headers.length) next.push("");
      if (b.x + patch.length > this.definition.headers.length) throw new PersistenceFailure(409, "Invalid record projection.");
      for (const [i, cell] of patch.entries()) next[b.x + i] = cell;
      // Existing business identity is never mutable through a positional update.
      const keyIndex = this.definition.headers.indexOf(this.definition.key || "id");
      if (keyIndex >= 0 && next[keyIndex] !== old.business_cells[keyIndex]) {
        if (this.definition.clearAsArchive && next[keyIndex] === "") {
          await client.query(`UPDATE ${this.table} SET archived_at=now(),revision=revision+1 WHERE row_order=$1 AND revision=$2`,[old.row_order,old.revision]);
          continue;
        }
        throw new PersistenceFailure(409, "Business identity cannot change.");
      }
      const columns = await this.columns();
      const result = await client.query(`UPDATE ${this.table} t SET ${columns.map(c => `"${c}"=i."${c}"`).join(',')} FROM stock_operational.input_${this.definition.table}($1::jsonb) i WHERE t.row_order=$2 AND t.revision=$3 AND t.archived_at IS NULL`, [JSON.stringify(next), old.row_order, old.revision]);
      if (result.rowCount !== 1) throw new PersistenceFailure(409, "Stale record revision.");
    }
  }
  async batchUpdateRows(updates: GoogleSheetRangeUpdate[]) { for (const update of updates) await this.updateRows(update.range, update.values); }
  async deleteRow(rowNumber: number) {
    const stored = await this.rows(), old = stored.find(row=>Number(row.row_order)===rowNumber-1 && !row.archived_at);
    if (!old) throw new PersistenceFailure(409, "Record no longer exists.");
    await requireMutation().query(`UPDATE ${this.table} SET archived_at=now(),revision=revision+1 WHERE row_order=$1 AND revision=$2`, [old.row_order,old.revision]);
  }
}
