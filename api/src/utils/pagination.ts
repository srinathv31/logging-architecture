export function calculatePagination(page: number, pageSize: number, totalCount: number) {
  const offset = (page - 1) * pageSize;
  const hasMore = offset + pageSize < totalCount;
  return { offset, hasMore };
}

export function extractTotalCount<T extends { totalCount?: number }>(
  rows: T[],
): { rows: Omit<T, 'totalCount'>[]; totalCount: number } {
  if (rows.length === 0) return { rows: [], totalCount: 0 };
  const totalCount = rows[0].totalCount ?? 0;
  const cleaned = rows.map(({ totalCount: _, ...rest }) => rest as Omit<T, 'totalCount'>);
  return { rows: cleaned, totalCount };
}
