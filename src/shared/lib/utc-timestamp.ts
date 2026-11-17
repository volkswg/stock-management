/** Compare canonical UTC instants without losing PostgreSQL microseconds.
 * Noncanonical legacy strings keep their existing comparison representation.
 * This key is never persisted or returned as a replacement DTO value.
 */
export function utcTimestampComparisonKey(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(value);
  return match ? `${match[1]}.${(match[2] || "").padEnd(6, "0")}Z` : value;
}
