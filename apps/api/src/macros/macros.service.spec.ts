import { Test, TestingModule } from '@nestjs/testing';
import { MacrosService } from './macros.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('MacrosService', () => {
  let service: MacrosService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: {
        macros: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
        },
      },
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MacrosService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<MacrosService>(MacrosService);
  });

  describe('findAll', () => {
    it('should return all macros', async () => {
      const mockMacros = [{ macroId: '1', name: 'Test Macro' }];
      mockDb.query.macros.findMany.mockResolvedValueOnce(mockMacros);

      const result = await service.findAll();
      expect(result).toEqual(mockMacros);
    });
  });

  describe('findOne', () => {
    it('should return a macro if found', async () => {
      const mockMacro = { macroId: '1', name: 'Test Macro' };
      mockDb.query.macros.findFirst.mockResolvedValueOnce(mockMacro);

      const result = await service.findOne('1');
      expect(result).toEqual(mockMacro);
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb.query.macros.findFirst.mockResolvedValueOnce(undefined);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return a new macro', async () => {
      const newMacro = {
        name: 'New Macro',
        content: 'Content',
        macroType: 'text_template',
      };
      const createdMacro = { macroId: '1', ...newMacro };
      mockDb.returning.mockResolvedValueOnce([createdMacro]);

      const result = await service.create(newMacro);
      expect(result).toEqual(createdMacro);
    });
  });

  describe('update', () => {
    it('should update and return the macro', async () => {
      const existingMacro = { macroId: '1', name: 'Old Macro' };
      const updatedMacro = { macroId: '1', name: 'Updated Macro' };

      mockDb.query.macros.findFirst.mockResolvedValueOnce(existingMacro);
      mockDb.returning.mockResolvedValueOnce([updatedMacro]);

      const result = await service.update('1', { name: 'Updated Macro' });
      expect(result).toEqual(updatedMacro);
    });
  });

  describe('remove', () => {
    it('should delete and return the macro', async () => {
      const existingMacro = { macroId: '1', name: 'Old Macro' };

      mockDb.query.macros.findFirst.mockResolvedValueOnce(existingMacro);
      mockDb.returning.mockResolvedValueOnce([existingMacro]);

      const result = await service.remove('1');
      expect(result).toEqual(existingMacro);
    });
  });
});
