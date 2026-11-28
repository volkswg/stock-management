import "server-only";

// The ECMAScript trim set, including tabs, NBSP and BOM. PostgreSQL btrim's
// default only removes spaces; use the same normalization as the existing DTOs.
export function trimmedSql(expression: string): string {
  return `btrim(coalesce(${expression}::text,''),E' \\t\\n\\r\\f\\u000b\\u00a0\\u1680\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff')`;
}
