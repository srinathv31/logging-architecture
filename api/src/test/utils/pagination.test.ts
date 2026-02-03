import { calculatePagination } from '../../utils/pagination';

describe('calculatePagination', () => {
  describe('offset calculation', () => {
    it('should return offset 0 for page 1', () => {
      const result = calculatePagination(1, 10, 100);
      expect(result.offset).toBe(0);
    });

    it('should calculate correct offset for page 2', () => {
      const result = calculatePagination(2, 10, 100);
      expect(result.offset).toBe(10);
    });

    it('should calculate correct offset for page 5 with pageSize 20', () => {
      const result = calculatePagination(5, 20, 200);
      expect(result.offset).toBe(80);
    });

    it('should handle pageSize of 1', () => {
      const result = calculatePagination(3, 1, 10);
      expect(result.offset).toBe(2);
    });

    it('should handle large page numbers', () => {
      const result = calculatePagination(100, 50, 10000);
      expect(result.offset).toBe(4950);
    });
  });

  describe('hasMore calculation', () => {
    it('should return true when more items exist', () => {
      const result = calculatePagination(1, 10, 100);
      expect(result.hasMore).toBe(true);
    });

    it('should return false when on last page (exact fit)', () => {
      const result = calculatePagination(10, 10, 100);
      expect(result.hasMore).toBe(false);
    });

    it('should return false when on last page (partial)', () => {
      const result = calculatePagination(3, 10, 25);
      expect(result.hasMore).toBe(false);
    });

    it('should return false when totalCount equals offset + pageSize', () => {
      const result = calculatePagination(2, 10, 20);
      expect(result.hasMore).toBe(false);
    });

    it('should return true when one more item exists', () => {
      const result = calculatePagination(2, 10, 21);
      expect(result.hasMore).toBe(true);
    });

    it('should return false when totalCount is 0', () => {
      const result = calculatePagination(1, 10, 0);
      expect(result.hasMore).toBe(false);
    });

    it('should return false when page exceeds total pages', () => {
      const result = calculatePagination(5, 10, 30);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle page 1 with empty results', () => {
      const result = calculatePagination(1, 10, 0);
      expect(result.offset).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle single item totalCount', () => {
      const result = calculatePagination(1, 10, 1);
      expect(result.offset).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle pageSize equal to totalCount', () => {
      const result = calculatePagination(1, 50, 50);
      expect(result.offset).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle pageSize larger than totalCount', () => {
      const result = calculatePagination(1, 100, 50);
      expect(result.offset).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
