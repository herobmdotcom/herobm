import { DrizzleAdapter } from './drizzle-adapter';
import { Model } from 'casbin';
import { casbinRule } from '@herobm/db-schema';

describe('DrizzleAdapter', () => {
  let adapter: DrizzleAdapter;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(true),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(true),
      }),
    };

    adapter = new DrizzleAdapter(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('savePolicy', () => {
    it('should bulk insert all policy ("p") and group ("g") rules in a single database operation', async () => {
      const model = new Model();
      model.loadModelFromText(`
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
      `);

      // Add 'p' policies
      model.addPolicy('p', 'p', ['admin', 'products', 'read']);
      model.addPolicy('p', 'p', ['admin', 'products', 'write']);
      model.addPolicy('p', 'p', ['viewer', 'products', 'read']);

      // Add 'g' group policies
      model.addPolicy('g', 'g', ['sales', 'viewer']);
      model.addPolicy('g', 'g', ['procurement', 'viewer']);

      const insertValuesMock = jest.fn().mockResolvedValue(true);
      mockDb.insert = jest.fn().mockReturnValue({ values: insertValuesMock });

      const result = await adapter.savePolicy(model);

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledWith(casbinRule);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalledWith(casbinRule);

      const insertedLines = insertValuesMock.mock.calls[0][0];
      expect(insertedLines).toHaveLength(5);
      expect(insertedLines).toEqual([
        {
          ptype: 'p',
          v0: 'admin',
          v1: 'products',
          v2: 'read',
          v3: null,
          v4: null,
          v5: null,
        },
        {
          ptype: 'p',
          v0: 'admin',
          v1: 'products',
          v2: 'write',
          v3: null,
          v4: null,
          v5: null,
        },
        {
          ptype: 'p',
          v0: 'viewer',
          v1: 'products',
          v2: 'read',
          v3: null,
          v4: null,
          v5: null,
        },
        {
          ptype: 'g',
          v0: 'sales',
          v1: 'viewer',
          v2: null,
          v3: null,
          v4: null,
          v5: null,
        },
        {
          ptype: 'g',
          v0: 'procurement',
          v1: 'viewer',
          v2: null,
          v3: null,
          v4: null,
          v5: null,
        },
      ]);
    });

    it('should drop existing policies without calling insert when model has no policies', async () => {
      const model = new Model();
      model.loadModelFromText(`
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && r.obj == p.obj && r.act == p.act
      `);

      const result = await adapter.savePolicy(model);

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledWith(casbinRule);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('loadPolicy', () => {
    it('should query casbinRule and load lines into the model', async () => {
      const model = new Model();
      model.loadModelFromText(`
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
      `);

      mockDb.from = jest.fn().mockResolvedValue([
        {
          ptype: 'p',
          v0: 'admin',
          v1: 'products',
          v2: 'read',
          v3: null,
          v4: null,
          v5: null,
        },
        {
          ptype: 'g',
          v0: 'sales',
          v1: 'viewer',
          v2: null,
          v3: null,
          v4: null,
          v5: null,
        },
      ]);

      await adapter.loadPolicy(model);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(casbinRule);
      expect(model.hasPolicy('p', 'p', ['admin', 'products', 'read'])).toBe(
        true,
      );
      expect(model.hasPolicy('g', 'g', ['sales', 'viewer'])).toBe(true);
    });
  });

  describe('addPolicy', () => {
    it('should insert a single policy line into casbinRule', async () => {
      const insertValuesMock = jest.fn().mockResolvedValue(true);
      mockDb.insert = jest.fn().mockReturnValue({ values: insertValuesMock });

      await adapter.addPolicy('p', 'p', ['admin', 'settings', 'write']);

      expect(mockDb.insert).toHaveBeenCalledWith(casbinRule);
      expect(insertValuesMock).toHaveBeenCalledWith({
        ptype: 'p',
        v0: 'admin',
        v1: 'settings',
        v2: 'write',
        v3: null,
        v4: null,
        v5: null,
      });
    });
  });

  describe('removePolicy', () => {
    it('should delete matching policy rule from casbinRule', async () => {
      await adapter.removePolicy('p', 'p', ['admin', 'settings', 'write']);

      expect(mockDb.delete).toHaveBeenCalledWith(casbinRule);
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('removeFilteredPolicy', () => {
    it('should delete filtered policy rules matching conditions', async () => {
      await adapter.removeFilteredPolicy('p', 'p', 0, 'admin', 'settings');

      expect(mockDb.delete).toHaveBeenCalledWith(casbinRule);
      expect(mockDb.where).toHaveBeenCalled();
    });
  });
});
