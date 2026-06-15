import { Test, TestingModule } from '@nestjs/testing';
import { MacrosService } from './macros.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { macros } from '../drizzle/herobm-core-schema';

describe('MacrosService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: MacrosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MacrosService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<MacrosService>(MacrosService);

    // Clean tables
    await pg.db.delete(macros);
  });

  describe('findAll', () => {
    it('should return all macros', async () => {
      await pg.db.insert(macros).values([
        { name: 'Macro 1', content: 'C1', macroType: 'text_template' },
        { name: 'Macro 2', content: 'C2', macroType: 'text_template' },
      ]);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a macro if found', async () => {
      const [m] = await pg.db
        .insert(macros)
        .values({
          name: 'Found',
          content: 'Content',
          macroType: 'text_template',
        })
        .returning();

      const result = await service.findOne(m.macroId);
      expect(result.name).toBe('Found');
    });

    it('should throw NotFoundException if not found', async () => {
      await expect(
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return a new macro', async () => {
      const data = {
        name: 'New Macro',
        content: 'Something',
        macroType: 'text_template' as const,
      };

      const result = await service.create(data);
      expect(result.name).toBe('New Macro');

      const inDb = await pg.db.query.macros.findFirst();
      expect(inDb?.name).toBe('New Macro');
    });
  });

  describe('update', () => {
    it('should update and return the macro', async () => {
      const [m] = await pg.db
        .insert(macros)
        .values({ name: 'Old', content: 'Old', macroType: 'text_template' })
        .returning();

      const result = await service.update(m.macroId, { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should delete and return the macro', async () => {
      const [m] = await pg.db
        .insert(macros)
        .values({ name: 'To Delete', content: 'X', macroType: 'text_template' })
        .returning();

      const result = await service.remove(m.macroId);
      expect(result.name).toBe('To Delete');

      const inDb = await pg.db.query.macros.findFirst();
      expect(inDb).toBeUndefined();
    });
  });
});
