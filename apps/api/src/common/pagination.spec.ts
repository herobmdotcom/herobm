import { withCursorPagination, encodeCursor } from './pagination';

describe('withCursorPagination', () => {
  // Mock Drizzle QueryBuilder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMockQb = (mockRows: any[]) => {
    return {
      limit: jest.fn().mockImplementation(function () {
        return Promise.resolve(mockRows);
      }),
    };
  };

  const applyWhere = jest.fn((q) => q);
  const applyOrderBy = jest.fn((q) => q);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const encodeRow = (row: any) => ({ id: row.id });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle the first page (direction: next, no cursor, hasMore: true)', async () => {
    // We request limit=2. The mock returns 3 items (limit + 1)
    const mockRows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const qb = createMockQb(mockRows);

    const result = await withCursorPagination({
      qb,
      limit: 2,
      cursorObj: null,
      direction: 'next',
      applyWhere,
      applyOrderBy,
      encodeRow,
    });

    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]); // Trims the 3rd item
    expect(result.prevCursor).toBeUndefined(); // First page has no previous page
    expect(result.nextCursor).toBe(encodeCursor({ id: 2 })); // Has next page
  });

  it('should handle a middle page (direction: next, has cursor, hasMore: true)', async () => {
    // We request limit=2. The mock returns 3 items
    const mockRows = [{ id: 3 }, { id: 4 }, { id: 5 }];
    const qb = createMockQb(mockRows);

    const result = await withCursorPagination({
      qb,
      limit: 2,
      cursorObj: { id: 2 },
      direction: 'next',
      applyWhere,
      applyOrderBy,
      encodeRow,
    });

    expect(result.data).toEqual([{ id: 3 }, { id: 4 }]);
    expect(result.prevCursor).toBe(encodeCursor({ id: 3 }));
    expect(result.nextCursor).toBe(encodeCursor({ id: 4 }));
  });

  it('should handle the last page (direction: next, has cursor, hasMore: false)', async () => {
    // We request limit=2. The mock returns 1 item (fewer than limit + 1)
    const mockRows = [{ id: 3 }];
    const qb = createMockQb(mockRows);

    const result = await withCursorPagination({
      qb,
      limit: 2,
      cursorObj: { id: 2 },
      direction: 'next',
      applyWhere,
      applyOrderBy,
      encodeRow,
    });

    expect(result.data).toEqual([{ id: 3 }]);
    expect(result.prevCursor).toBe(encodeCursor({ id: 3 }));
    expect(result.nextCursor).toBeUndefined(); // Last page has no next page
  });

  it('should handle navigating backwards (direction: prev, has cursor, hasMore: true)', async () => {
    // We request limit=2. Query is DESC, so items return in reverse order.
    // E.g., we asked for < 5. DB returns 4, 3, 2. (limit + 1)
    const mockRows = [{ id: 4 }, { id: 3 }, { id: 2 }];
    const qb = createMockQb(mockRows);

    const result = await withCursorPagination({
      qb,
      limit: 2,
      cursorObj: { id: 5 },
      direction: 'prev',
      applyWhere,
      applyOrderBy,
      encodeRow,
    });

    // The data should be reversed to natural order [3, 4]
    expect(result.data).toEqual([{ id: 3 }, { id: 4 }]);
    expect(result.prevCursor).toBe(encodeCursor({ id: 3 })); // There are items before 3 (hasMore was true)
    expect(result.nextCursor).toBe(encodeCursor({ id: 4 }));
  });

  it('should handle reaching the first page backwards (direction: prev, has cursor, hasMore: false)', async () => {
    // We request limit=2. Query is DESC. We asked for < 3.
    // DB returns 2, 1. (Exactly limit, or fewer, meaning no more items before them)
    const mockRows = [{ id: 2 }, { id: 1 }];
    const qb = createMockQb(mockRows);

    const result = await withCursorPagination({
      qb,
      limit: 2,
      cursorObj: { id: 3 },
      direction: 'prev',
      applyWhere,
      applyOrderBy,
      encodeRow,
    });

    // The data should be reversed to natural order [1, 2]
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.prevCursor).toBeUndefined(); // No items before 1 (hasMore was false)
    expect(result.nextCursor).toBe(encodeCursor({ id: 2 }));
  });
});
