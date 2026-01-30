export function calculatePagination(page: number, pageSize: number, totalCount: number) {
  const offset = (page - 1) * pageSize;
  const hasMore = offset + pageSize < totalCount;
  return { offset, hasMore };
}
