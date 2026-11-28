import "server-only";
import { currentTransaction, requireMutation, PersistenceFailure } from "./database";

export type RecordValue = string | number | boolean | null;
export type Column = { readonly column: string; readonly kind: "text" | "numeric" | "bigint" | "boolean" | "timestamp" | "jsonb" | "media"; readonly trimBoolean?: boolean; readonly textOnly?: boolean; readonly nullText?: "null" };
export type NativeRecord = Readonly<Record<string, RecordValue>>;
export type Columns = Readonly<Record<string, Column>>;
export type NamedRecord<C extends Columns> = { readonly [K in keyof C]: RecordValue };
export interface RecordStore {
  prepare(): Promise<void>;
  all(direction?: "ascending" | "descending"): Promise<NativeRecord[]>;
  select(predicate: string, values: readonly unknown[], direction?: "ascending" | "descending"): Promise<NativeRecord[]>;
  find(id: string): Promise<NativeRecord | undefined>;
  insert(value: Readonly<Record<string, RecordValue | undefined>>): Promise<void>;
  update(record: NativeRecord, patch: Readonly<Record<string, RecordValue | undefined>>): Promise<void>;
  softDelete(record: NativeRecord): Promise<void>;
  reserveIdentifier(): Promise<string>;
  nextIdentifier(): Promise<number>;
  identifierSequence(): Promise<() => number>;
}
type Identity = { id: string; revision: string; client: ReturnType<typeof currentTransaction> };
const schemas = new WeakMap<ReturnType<typeof currentTransaction>, Promise<void>>();
const identityLayouts = new WeakMap<ReturnType<typeof currentTransaction>, Map<string, Promise<string | null>>>();
const allocators = new WeakMap<ReturnType<typeof currentTransaction>, Map<string, Promise<{ next: number }>>>();
const quote = (name: string) => {
  if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name)) throw new PersistenceFailure();
  return '"' + name + '"';
};

async function requireNativeSchema() {
  const client = currentTransaction();
  let pending = schemas.get(client);
  if (!pending) {
    pending = client.query<{ deletion: string; media: string; mapping: string }>("SELECT stock_operational.soft_delete_contract_v1() AS deletion,stock_operational.media_record_contract_v1() AS media,stock_operational.lexeme_mapping_contract_v1() AS mapping")
      .then(result => {
        if (result.rowCount !== 1 || result.rows[0].deletion !== "deletedAt" || result.rows[0].media !== "id-only" || result.rows[0].mapping !== "typed") throw new PersistenceFailure(503, "Unsupported PostgreSQL record schema.");
      });
    schemas.set(client, pending);
  }
  await pending;
}

// Shared SQL transport for the explicit column maps owned by each feature.
// No worksheet schema, positional fields, range parsing or fallback storage.
export class NativeRecords<C extends Columns> {
  private readonly identities = new WeakMap<object, Identity>();
  private readonly relation: string;
  constructor(readonly table: string, readonly columns: C, readonly key = "id", readonly databaseIdentity = false) {
    this.relation = "stock_operational." + quote(table);
    quote(key);
    for (const [name, column] of Object.entries(columns)) { quote(name); quote(column.column); }
  }
  private async identitySequence(): Promise<string | null> {
    if (!this.databaseIdentity) return null;
    const client = currentTransaction();
    let layouts = identityLayouts.get(client);
    if (!layouts) { layouts = new Map(); identityLayouts.set(client, layouts); }
    let pending = layouts.get(this.table);
    if (!pending) {
      pending = client.query<{ type: string; identity: string; sequence: string | null }>(
        "SELECT format_type(a.atttypid,a.atttypmod) AS type,a.attidentity AS identity,pg_get_serial_sequence($1,$2) AS sequence FROM pg_attribute a WHERE a.attrelid=$1::regclass AND a.attname=$2 AND NOT a.attisdropped",
        [this.relation, this.key],
      ).then(result => {
        const row = result.rows[0];
        if (result.rowCount === 1 && row.type === "text" && row.identity === "" && row.sequence === null) return null;
        if (result.rowCount === 1 && row.type === "bigint" && row.identity === "d" && row.sequence) return row.sequence;
        throw new PersistenceFailure(503, "Unsupported record identity layout.");
      });
      layouts.set(this.table, pending);
    }
    return pending;
  }
  // Numeric storage still exposes the original canonical string IDs and C-order
  // tie-break. Reject aliases such as 01/+1 instead of selecting another record.
  private keyValue(id: string, numeric: boolean): boolean {
    return !numeric || /^(0|[1-9][0-9]*)$/.test(id) && id.length <= 19 && BigInt(id) <= BigInt("9223372036854775807");
  }
  private keyParameter(position: number, numeric: boolean) {
    return `$${position}::text${numeric ? "::bigint" : ""}`;
  }
  private projection() {
    return Object.entries(this.columns).map(([name, field]) => {
      const value = "t." + quote(field.column);
      const expression = field.kind === "timestamp" ? `coalesce(stock_operational.native_timestamp_text(${value}),'')`
        : field.kind === "media" ? `stock_operational.media_url_v1(${value})`
        : field.kind === "boolean" ? `coalesce(to_jsonb(${value}),'""'::jsonb)`
        : `coalesce(${value}::text,${field.nullText === "null" ? "'null'" : "''"})`;
      return expression + " AS " + quote(name);
    }).join(",");
  }
  private tracked(row: NamedRecord<C> & { __id: string; __revision: string }): NamedRecord<C> {
    const { __id, __revision, ...record } = row;
    this.identities.set(record, { id: __id, revision: __revision, client: currentTransaction() });
    return record as unknown as NamedRecord<C>;
  }
  async prepare(): Promise<void> { await requireNativeSchema(); await this.identitySequence(); await currentTransaction().query(`SELECT ${this.projection()} FROM ${this.relation} t LIMIT 0`); }
  async all(direction: "ascending" | "descending" = "ascending"): Promise<NamedRecord<C>[]> {
    return this.select("true", [], direction);
  }
  // Feature adapters supply closed SQL predicates; request values are always binds.
  // Reuse the same projection, ordering and tracked revision for scoped writes.
  async select(predicate: string, values: readonly unknown[], direction: "ascending" | "descending" = "ascending"): Promise<NamedRecord<C>[]> {
    await requireNativeSchema();
    await this.identitySequence();
    const result = await currentTransaction().query<NamedRecord<C> & { __id: string; __revision: string }>(`SELECT t.${quote(this.key)}::text AS __id,t.revision::text AS __revision,${this.projection()} FROM ${this.relation} t WHERE t."deletedAt" IS NULL AND (${predicate}) ORDER BY t."createdAt" ${direction === "descending" ? "DESC" : "ASC"} NULLS LAST,t.${quote(this.key)}::text COLLATE "C" ASC`, [...values]);
    return result.rows.map(row => this.tracked(row));
  }
  async find(id: string): Promise<NamedRecord<C> | undefined> {
    await requireNativeSchema();
    const numeric = !!await this.identitySequence();
    if (!this.keyValue(id, numeric)) return undefined;
    const result = await currentTransaction().query<NamedRecord<C> & { __id: string; __revision: string }>(`SELECT t.${quote(this.key)}::text AS __id,t.revision::text AS __revision,${this.projection()} FROM ${this.relation} t WHERE t.${quote(this.key)}=${this.keyParameter(1, numeric)} AND t."deletedAt" IS NULL`, [id]);
    return result.rows[0] ? this.tracked(result.rows[0]) : undefined;
  }
  private input(name: string, position: number, numericKey = false) {
    const field = this.columns[name];
    if (!field) throw new PersistenceFailure(409, "Unknown record field.");
    if (numericKey && name === this.key) return this.keyParameter(position, true);
    const value = `nullif($${position}::text,'')`;
    return field.kind === "timestamp" ? `stock_operational.native_timestamp_input($${position}::text)`
      : field.kind === "media" ? `stock_operational.media_ref_for_url_v1(${value})`
      : value + (field.kind === "numeric" ? "::numeric" : field.kind === "bigint" ? "::bigint" : field.kind === "boolean" ? "::boolean" : field.kind === "jsonb" ? "::jsonb" : "");
  }
  private values(value: Readonly<Partial<Record<keyof C, RecordValue | undefined>>>) {
    for (const item of Object.values(value)) if (item !== undefined && item !== null && !["string", "number", "boolean"].includes(typeof item)) throw new PersistenceFailure(409, "Invalid record value.");
    return Object.entries(value).map(([name, item]) => {
      if (item == null || (typeof item === "number" && !Number.isFinite(item))) return null;
      const field = this.columns[name];
      if (field?.textOnly && typeof item !== "string") throw new PersistenceFailure();
      const text = String(item);
      if (field?.kind !== "boolean" || text === "") return text;
      const boolean = (field.trimBoolean ? text.trim() : text).toLowerCase();
      // PostgreSQL accepts aliases such as 1/t/yes. Existing business adapters
      // accept only explicit true/false; keep that narrower input contract.
      if (!["true", "false"].includes(boolean)) throw new PersistenceFailure();
      return boolean;
    });
  }
  async insert(value: Readonly<Partial<Record<keyof C, RecordValue | undefined>>>): Promise<void> {
    const client = requireMutation(); await requireNativeSchema();
    const numeric = !!await this.identitySequence();
    if (numeric && !this.keyValue(String(value[this.key] ?? ""), true)) throw new PersistenceFailure(409, "Invalid record identity.");
    const names = Object.keys(value);
    if (!names.length || (this.key === "id" && (typeof value[this.key] !== "string" || !value[this.key]))) throw new PersistenceFailure(409, "Business identity is required.");
    const synthetic = this.key === "migration_id";
    const expressions = names.map((name, i) => this.input(name, i + 1, numeric));
    await client.query(`INSERT INTO ${this.relation}(${synthetic ? 'migration_id,' : ''}${names.map(name => quote(this.columns[name].column)).join(",")}) VALUES(${synthetic ? "'COMP-'||gen_random_uuid()::text," : ""}${expressions.join(",")})`, this.values(value));
  }
  async update(record: NamedRecord<C>, patch: Readonly<Partial<Record<keyof C, RecordValue | undefined>>>): Promise<void> {
    const client = requireMutation(), identity = this.identities.get(record);
    if (!identity || identity.client !== currentTransaction()) throw new PersistenceFailure(409, "Read the record again before editing.");
    const numeric = !!await this.identitySequence();
    const names = Object.keys(patch);
    if (!names.length) return;
    if (Object.hasOwn(patch, this.key) && patch[this.key] !== identity.id) throw new PersistenceFailure(409, "Business identity cannot change.");
    const assignments = names.map((name, i) => { const input = this.input(name, i + 1, numeric); return `${quote(this.columns[name].column)}=${input}`; }).join(",");
    const result = await client.query<{ revision: string }>(`UPDATE ${this.relation} SET ${assignments} WHERE ${quote(this.key)}=${this.keyParameter(names.length + 1, numeric)} AND revision=$${names.length + 2} AND "deletedAt" IS NULL RETURNING revision::text`, [...this.values(patch), identity.id, identity.revision]);
    if (result.rowCount !== 1) throw new PersistenceFailure(409, "Stale record revision.");
    identity.revision = result.rows[0].revision;
  }
  async softDelete(record: NamedRecord<C>): Promise<void> {
    const client = requireMutation(), identity = this.identities.get(record);
    if (!identity || identity.client !== currentTransaction()) throw new PersistenceFailure(409, "Read the record again before editing.");
    const numeric = !!await this.identitySequence();
    const result = await client.query<{ revision: string }>(`UPDATE ${this.relation} SET "deletedAt"=now() WHERE ${quote(this.key)}=${this.keyParameter(1, numeric)} AND revision=$2 AND "deletedAt" IS NULL RETURNING revision::text`, [identity.id, identity.revision]);
    if (result.rowCount !== 1) throw new PersistenceFailure(409, "Stale record revision.");
    identity.revision = result.rows[0].revision;
  }
  async identifierSequence(): Promise<() => number> {
    const client = currentTransaction(); await requireNativeSchema();
    if (await this.identitySequence()) throw new PersistenceFailure(503, "Use database identity reservation for this record.");
    let tables = allocators.get(client); if (!tables) { tables = new Map(); allocators.set(client, tables); }
    let pending = tables.get(this.table);
    if (!pending) {
      pending = client.query<{ next: string }>(`SELECT (greatest(coalesce(max(CASE WHEN ${quote(this.key)} ~ '^[0-9]+$' THEN ${quote(this.key)}::numeric END),1),1)+1)::text AS next FROM ${this.relation}`).then(result => ({ next: Number(result.rows[0].next) }));
      tables.set(this.table, pending);
    }
    const allocator = await pending;
    return () => {
      if (client !== currentTransaction() || !Number.isSafeInteger(allocator.next + 1) || allocator.next < 2) throw new PersistenceFailure(503, "Record identifier exceeds supported capacity.");
      return allocator.next++;
    };
  }
  async reserveIdentifier(): Promise<string> {
    const client = requireMutation(); await requireNativeSchema();
    const sequence = await this.identitySequence();
    if (!sequence) return String(await this.nextIdentifier());
    const result = await client.query<{ id: string }>("SELECT nextval($1::regclass)::text AS id", [sequence]);
    if (result.rowCount !== 1 || !this.keyValue(result.rows[0].id, true)) throw new PersistenceFailure(503, "Record identifier exceeds supported capacity.");
    return result.rows[0].id;
  }
  async nextIdentifier(): Promise<number> { return (await this.identifierSequence())(); }
}
