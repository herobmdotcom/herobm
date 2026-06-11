import { getTableName } from 'drizzle-orm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTableName(table: any): string {
  if (typeof table === 'string') return table;
  try {
    return getTableName(table);
  } catch (e) {
    // Fallback if not a drizzle table
    if (table && table._ && table._.name) return table._.name;
    if (table && table.name) return table.name;
    return 'unknown';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockQueryBuilder(resolveDataFn: () => any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    returning: jest
      .fn()
      .mockImplementation(() => Promise.resolve(resolveDataFn())),
    then: jest.fn().mockImplementation((cb) => {
      const data = resolveDataFn();
      if (typeof cb === 'function') {
        return Promise.resolve(data).then(cb);
      }
      return Promise.resolve(data);
    }),
  };
  return qb;
}

export class MockDrizzle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tableMocks = new Map<string, any[] | (() => any[])>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private defaultMock: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public _selectQb: any;

  constructor() {
    this._selectQb = createMockQueryBuilder(() => this.defaultMock);
  }

  /**
   * Mocks the return value of a query when it targets a specific table.
   * Use the Drizzle schema object (e.g., `schema.products`) or string name.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onTable(table: any, data: any[] | (() => any[])) {
    const tableName = extractTableName(table);
    this.tableMocks.set(tableName, data);
    return this;
  }

  private resolveMock(currentTable: string | null) {
    if (currentTable && this.tableMocks.has(currentTable)) {
      const mock = this.tableMocks.get(currentTable);
      return typeof mock === 'function' ? mock() : mock;
    }
    return typeof this.defaultMock === 'function'
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.defaultMock as any)()
      : this.defaultMock;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDefault(data: any[]) {
    this.defaultMock = data;
    return this;
  }

  clearMocks() {
    this.tableMocks.clear();
    this.defaultMock = [];
  }

  select = jest.fn().mockImplementation(() => {
    let currentTable: string | null = null;

    const qb = createMockQueryBuilder(() => this.resolveMock(currentTable));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qb.from = jest.fn().mockImplementation((table: any) => {
      currentTable = extractTableName(table);
      return qb;
    });

    return qb;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert = jest.fn().mockImplementation((table: any) => {
    const currentTable = extractTableName(table);
    return createMockQueryBuilder(() => {
      const resolved = this.resolveMock(currentTable);
      return resolved.length ? resolved : [{}];
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update = jest.fn().mockImplementation((table: any) => {
    const currentTable = extractTableName(table);
    return createMockQueryBuilder(() => {
      const resolved = this.resolveMock(currentTable);
      return resolved.length ? resolved : [{}];
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete = jest.fn().mockImplementation((table: any) => {
    const currentTable = extractTableName(table);
    return createMockQueryBuilder(() => {
      const resolved = this.resolveMock(currentTable);
      return resolved.length ? resolved : [{}];
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transaction = jest.fn().mockImplementation(async (cb: any) => {
    // In a transaction, we just pass this same instance, or a clone that shares mocks
    return cb(this);
  });
}
