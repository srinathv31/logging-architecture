/**
 * Formats a search query for MSSQL full-text CONTAINS.
 * Escapes special characters and converts words to prefix search terms.
 */
export function formatFullTextQuery(query: string): string {
  const escaped = query.replace(/["\[\]{}()*?\\!]/g, "");
  const words = escaped.trim().split(/\s+/).filter((w) => w.length > 0);
  return words.length === 1
    ? `"${words[0]}*"`
    : words.map((w) => `"${w}*"`).join(" AND ");
}
