import "server-only";
import { currentTransaction, requireMutation, PersistenceFailure } from "./database";
import type { GoogleSheetRow, GoogleSheetRangeUpdate, RecordReference } from "../google-sheets/types";

export type TableDefinition = { table: string; headers: readonly string[]; key?: string; clearAsArchive?: boolean; numericIdentifiers?: boolean };
type NumericAllocator = { next: number; client: ReturnType<typeof currentTransaction> };
// A fresh safe client proxy identifies each unit of work. Share reservations
// across service instances and concurrent attachment operations within it.
const numericAllocators = new WeakMap<ReturnType<typeof currentTransaction>, Map<string, Promise<NumericAllocator>>>();
type StoredRecord = { record_id: string; business_cells: GoogleSheetRow; revision: string };
function bounds(range: string, length: number) {
  const normalized = /^([A-Z]+)(\d+)$/.test(range) ? `${range}:${range}` : range;
  const match = /^([A-Z]+)(\d*)?:([A-Z]+)(\d*)?$/.exec(normalized);
  if (!match) throw new PersistenceFailure(503, "Unsupported record projection.");
  const column = (value: string) => [...value].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1;
  return { x: column(match[1]), y: column(match[3]) + 1, start: Number(match[2] || 1) - 1, end: match[4] ? Number(match[4]) : length };
}

// Feature ports retain their wire formats. Private row handles bind PK/revision;
// positions never locate a PostgreSQL mutation.
export class PostgresRecords {
  readonly table: string;
  private readonly key: string;
  private readonly identities = new WeakMap<GoogleSheetRow, StoredRecord>();
  private readonly identifiers = new WeakMap<GoogleSheetRow[], NumericAllocator>();
  constructor(readonly definition: TableDefinition) {
    this.key = definition.key || "id";
    if (!/^[a-z_]+$/.test(definition.table) || !/^[a-z_]+$/.test(this.key) || definition.headers.some(h => !/^[a-zA-Z_]+$/.test(h))) throw new PersistenceFailure();
    this.table = `stock_operational.${definition.table}`;
  }
  async ensureExists() { await currentTransaction().query(`SELECT 1 FROM ${this.table} LIMIT 0`); }
  async checkConnection() { await this.ensureExists(); }
  private async read(range: string, selection: boolean, descending = false): Promise<GoogleSheetRow[]> {
    // Explicit compatibility-only business precedence, not display sort/identity.
    const order = selection ? 'row_order' : `created_at_instant ${descending ? "DESC" : "ASC"} NULLS LAST,"${this.key}" COLLATE "C" ASC`;
    const stored = (await currentTransaction().query<StoredRecord>(`SELECT "${this.key}" AS record_id,stock_operational.project_${this.definition.table}(t) AS business_cells,revision FROM ${this.table} t WHERE archived_at IS NULL ORDER BY ${order}`)).rows;
    const rows: GoogleSheetRow[] = [[...this.definition.headers], ...stored.map(r => r.business_cells)];
    const b = bounds(range, rows.length);
    const result = rows.slice(b.start, b.end).map((row, i) => {
      const projected = row.slice(b.x, b.y), record = stored[b.start+i-1];
      if (record) this.identities.set(projected, record);
      return projected;
    });
    if (this.definition.numericIdentifiers) this.identifiers.set(result, await this.numericAllocator());
    return result;
  }
  // Explicit creation order; unknowns last and a deterministic ID tie-breaker.
  // Feature use cases keep their existing business-date/name sorts.
  async readRows(range = "A:ZZ") { return this.read(range, false); }
  async readSelectionRows(range = "A:ZZ") { return this.read(range, true); }
  async readCreationRows(range = "A:ZZ", direction: "ascending" | "descending" = "ascending") { return this.read(range, false, direction === "descending"); }
  private async numericAllocator(): Promise<NumericAllocator> {
    if (!this.definition.numericIdentifiers) throw new PersistenceFailure(503, "Numeric identifiers are not configured.");
    const client = currentTransaction();
    let entries = numericAllocators.get(client);
    if (!entries) { entries = new Map(); numericAllocators.set(client, entries); }
    let pending = entries.get(this.table);
    if (!pending) {
      pending = client.query<{ next: string }>(`SELECT (greatest(coalesce(max(CASE WHEN "${this.key}" ~ '^[0-9]+$' THEN "${this.key}"::numeric END),1),1)+1)::text AS next FROM ${this.table}`)
        .then(result => ({next: Number(result.rows[0].next), client}));
      entries.set(this.table, pending);
    }
    return pending;
  }
  private takeNumber(allocator: NumericAllocator): number {
    if (allocator.client !== currentTransaction() || !Number.isSafeInteger(allocator.next+1) || allocator.next < 2) throw new PersistenceFailure(503, "Record identifier exceeds supported capacity or snapshot is stale.");
    return allocator.next++;
  }
  async nextRecordNumber(): Promise<number> { return this.takeNumber(await this.numericAllocator()); }
  identifierAfter(rows: GoogleSheetRow[]): number {
    const allocator = this.identifiers.get(rows);
    if (!allocator) throw new PersistenceFailure(503, "Identifier snapshot is unavailable.");
    return this.takeNumber(allocator);
  }
  private async columns(): Promise<string[]> {
    const result = await currentTransaction().query<{column_name: string}>(`SELECT column_name FROM information_schema.columns WHERE table_schema='stock_operational' AND table_name=$1 ORDER BY ordinal_position`, [this.definition.table]);
    return result.rows.map(r => r.column_name).filter(c => this.definition.headers.includes(c) || c === 'cell_kinds' || (c.endsWith('__lexeme') && this.definition.headers.includes(c.slice(0,-8))));
  }
  private async insert(cells: GoogleSheetRow) {
    const client = requireMutation(), key = this.key;
    if (cells.length > this.definition.headers.length || !cells.length) throw new PersistenceFailure(409, "Invalid record width.");
    const id = key === "migration_id" ? undefined : cells[this.definition.headers.indexOf(key)];
    if (key !== "migration_id" && (typeof id !== "string" || !id)) throw new PersistenceFailure(409, "Business identity is required.");
    const columns = await this.columns(), names = columns.map(c => `"${c}"`).join(',');
    // Populate retained compatibility metadata, never a business identifier.
    await client.query(`INSERT INTO ${this.table}(${key === "migration_id" ? 'migration_id,' : ''}${names},row_order) SELECT ${key === "migration_id" ? "'COMP-'||gen_random_uuid()::text," : ''}${columns.map(c => `i."${c}"`).join(',')},(SELECT coalesce(max(row_order),0)+1 FROM ${this.table}) FROM stock_operational.input_${this.definition.table}($1::jsonb) i`, [JSON.stringify(cells)]);
  }
  async appendRows(_range: string, values: GoogleSheetRow[]) { for (const row of values) await this.insert(row); }
  referenceRow(row: GoogleSheetRow): RecordReference {
    const stored = this.identities.get(row);
    if (!stored) throw new PersistenceFailure(409, "Record identity is unavailable. Read the record again.");
    return this.reference(stored);
  }
  async referenceId(id: string): Promise<RecordReference | undefined> {
    const result = await currentTransaction().query<StoredRecord>(`SELECT "${this.key}" AS record_id,stock_operational.project_${this.definition.table}(t) AS business_cells,revision FROM ${this.table} t WHERE "${this.key}"=$1 AND archived_at IS NULL`, [id]);
    return result.rows[0] ? this.reference(result.rows[0]) : undefined;
  }
  private reference(stored: StoredRecord): RecordReference {
    const archive = async () => {
      const result = await requireMutation().query<{revision: string}>(`UPDATE ${this.table} SET archived_at=now(),revision=revision+1 WHERE "${this.key}"=$1 AND revision=$2 AND archived_at IS NULL RETURNING revision`, [stored.record_id, stored.revision]);
      if (result.rowCount !== 1) throw new PersistenceFailure(409, "Stale record revision.");
      stored.revision = result.rows[0].revision;
    };
    return { archive, update: (columns, patch) => this.updateReference(stored, columns, patch, archive) };
  }
  private async updateReference(stored: StoredRecord, range: string, patch: GoogleSheetRow, archive: () => Promise<void>) {
    const parts = /^([A-Z]+)(?::([A-Z]+))?$/.exec(range);
    if (!parts) throw new PersistenceFailure(409, "Invalid record columns.");
    const b = bounds(parts[1]+'1:'+ (parts[2] || parts[1])+'1', 1);
    if (b.x+patch.length > b.y || b.y > this.definition.headers.length) throw new PersistenceFailure(409, "Invalid record projection.");
    const next = [...stored.business_cells];
    while (next.length < this.definition.headers.length) next.push("");
    for (const [i,cell] of patch.entries()) next[b.x+i] = cell;
    const keyIndex = this.definition.headers.indexOf(this.key);
    if (keyIndex >= 0 && next[keyIndex] !== stored.business_cells[keyIndex]) {
      if (this.definition.clearAsArchive && next[keyIndex] === "" && patch.every(c=>c==="")) return archive();
      throw new PersistenceFailure(409, "Business identity cannot change.");
    }
    const columns = await this.columns();
    const result = await requireMutation().query<StoredRecord>(`UPDATE ${this.table} t SET ${columns.map(c => `"${c}"=i."${c}"`).join(',')} FROM stock_operational.input_${this.definition.table}($1::jsonb) i WHERE t."${this.key}"=$2 AND t.revision=$3 AND t.archived_at IS NULL RETURNING t."${this.key}" AS record_id,stock_operational.project_${this.definition.table}(t) AS business_cells,t.revision`, [JSON.stringify(next), stored.record_id, stored.revision]);
    if (result.rowCount !== 1) throw new PersistenceFailure(409, "Stale record revision.");
    Object.assign(stored, result.rows[0]);
  }
  async updateRows(range: string, values: GoogleSheetRow[]) {
    const b = bounds(range, 1);
    if (b.start !== 0 || b.end !== 1 || values.length !== 1 || JSON.stringify(values[0]) !== JSON.stringify(this.definition.headers.slice(b.x,b.x+values[0].length))) throw new PersistenceFailure(409, "Use a stable record reference for updates.");
    requireMutation();
  }
  async batchUpdateRows(updates: GoogleSheetRangeUpdate[]) { for (const update of updates) await this.updateRows(update.range, update.values); }
  async deleteRow(rowNumber: number): Promise<void> { void rowNumber; throw new PersistenceFailure(409, "Use a stable record reference for deletion."); }
}
