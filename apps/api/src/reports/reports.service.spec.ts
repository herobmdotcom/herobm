import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { ReportsRegistry } from './reports.registry';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as child_process from 'child_process';

// Mock fs and child_process for Typst compilation testing
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('fake-pdf-content')),
  unlinkSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, ...args) => {
    const cb = args[args.length - 1];
    if (cmd.includes('fail_binary')) {
      const err = new Error('Typst error');
      (err as any).stderr = 'Compiler failed';
      cb(err, '', 'Compiler failed');
    } else {
      cb(null, 'Compiled', '');
    }
  }),
}));

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockDb() {
  const db: any = {
    query: {
      reportHookAssignments: {
        findFirst: jest.fn(),
      },
      reports: {
        findFirst: jest.fn(),
      },
    },
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    }),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
  };
  return db;
}

describe('ReportsService', () => {
  let service: ReportsService;
  let mockDb: any;
  let mockRegistry: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();

    mockRegistry = {
      getResolver: jest.fn(),
      getRegisteredContexts: jest
        .fn()
        .mockReturnValue(['sales_order', 'purchase_order']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ReportsRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('runHook', () => {
    it('should throw NotFoundException if hook assignment not found', async () => {
      mockDb.query.reportHookAssignments.findFirst.mockResolvedValue(null);
      await expect(
        service.runHook('print_invoice', '1', 'sales_order', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if report not found', async () => {
      mockDb.query.reportHookAssignments.findFirst.mockResolvedValue({
        reportId: 'r1',
      });
      mockDb.query.reports.findFirst.mockResolvedValue(null);
      await expect(
        service.runHook('print_invoice', '1', 'sales_order', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException if resolver is missing', async () => {
      mockDb.query.reportHookAssignments.findFirst.mockResolvedValue({
        reportId: 'r1',
      });
      mockDb.query.reports.findFirst.mockResolvedValue({
        id: 'r1',
        template: '',
      });
      mockRegistry.getResolver.mockReturnValue(null);

      await expect(
        service.runHook('print_invoice', '1', 'sales_order', {}),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should compile and return PDF and formatted filename', async () => {
      mockDb.query.reportHookAssignments.findFirst.mockResolvedValue({
        reportId: 'r1',
      });
      mockDb.query.reports.findFirst.mockResolvedValue({
        id: 'r1',
        template: 'body',
        outputNamePattern: '${orderNo}.pdf',
      });

      const mockResolver = {
        resolveData: jest.fn().mockResolvedValue({ orderNo: 'ORD-123' }),
      };
      mockRegistry.getResolver.mockReturnValue(mockResolver);

      const result = await service.runHook(
        'print_invoice',
        '1',
        'sales_order',
        {},
      );

      expect(result.fileName).toBe('ORD-123.pdf');
      expect(result.pdfBuffer).toBeDefined();
      expect(mockResolver.resolveData).toHaveBeenCalledWith('1', {});
      expect(child_process.exec).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on Typst compilation failure', async () => {
      mockDb.query.reportHookAssignments.findFirst.mockResolvedValue({
        reportId: 'r1',
      });
      mockDb.query.reports.findFirst.mockResolvedValue({
        id: 'r1',
        template: 'body',
        outputNamePattern: 'Invoice.pdf',
      });

      const mockResolver = {
        resolveData: jest.fn().mockResolvedValue({}),
      };
      mockRegistry.getResolver.mockReturnValue(mockResolver);

      // Trigger fail branch in mock
      process.env.TYPST_BINARY_PATH = 'fail_binary';

      await expect(
        service.runHook('print_invoice', '1', 'sales_order', {}),
      ).rejects.toThrow(InternalServerErrorException);

      delete process.env.TYPST_BINARY_PATH;
    });
  });

  describe('CRUD operations', () => {
    it('should return all reports', async () => {
      const qb = createMockQueryBuilder([{ id: 'r1' }]);
      mockDb.select.mockReturnValue({ from: jest.fn().mockReturnValue(qb) });
      const res = await service.getReports();
      expect(res).toHaveLength(1);
    });

    it('should get a report by id', async () => {
      mockDb.query.reports.findFirst.mockResolvedValue({ id: 'r1' });
      const res = await service.getReportById('r1');
      expect(res.id).toBe('r1');
    });

    it('should throw on getting missing report by id', async () => {
      mockDb.query.reports.findFirst.mockResolvedValue(null);
      await expect(service.getReportById('r1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create a report', async () => {
      const qb = createMockQueryBuilder([{ id: 'r1' }]);
      mockDb.insert.mockReturnValue({ values: jest.fn().mockReturnValue(qb) });
      const res = await service.createReport({
        name: 'Test',
        slug: 'test',
        template: '',
      });
      expect(res.id).toBe('r1');
    });

    it('should update a report', async () => {
      const qb = createMockQueryBuilder([{ id: 'r1' }]);
      mockDb.update.mockReturnValue(qb);
      const res = await service.updateReport('r1', { name: 'New Name' });
      expect(res.id).toBe('r1');
    });

    it('should throw NotFound when updating missing report', async () => {
      const qb = createMockQueryBuilder([]); // Empty resolves to null updating
      mockDb.update.mockReturnValue(qb);
      await expect(
        service.updateReport('r1', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Registry delegates', () => {
    it('should return hooks list', async () => {
      const res = await service.getHooksList();
      expect(res).toEqual([
        { contextSlug: 'sales_order' },
        { contextSlug: 'purchase_order' },
      ]);
    });

    it('should get random ID for context', async () => {
      mockRegistry.getResolver.mockReturnValue({
        getRandomId: jest.fn().mockResolvedValue('123'),
      });
      const res = await service.getRandomIdForContext('sales_order');
      expect(res).toBe('123');
    });

    it('should return null if resolver does not implement getRandomId', async () => {
      mockRegistry.getResolver.mockReturnValue({});
      const res = await service.getRandomIdForContext('sales_order');
      expect(res).toBeNull();
    });

    it('should throw exception if resolver missing for getRandomId', async () => {
      mockRegistry.getResolver.mockReturnValue(null);
      await expect(service.getRandomIdForContext('bad')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('renderPreview', () => {
    it('should render PDF with raw mock data', async () => {
      const result = await service.renderPreview('body', { test: true });
      expect(result).toBeDefined();
    });

    it('should resolve context data if entityId provided', async () => {
      const mockResolver = {
        resolveData: jest.fn().mockResolvedValue({ test: true }),
      };
      mockRegistry.getResolver.mockReturnValue(mockResolver);

      const result = await service.renderPreview(
        'body',
        {},
        'sales_order',
        '1',
        {},
      );
      expect(result).toBeDefined();
      expect(mockResolver.resolveData).toHaveBeenCalledWith('1', {});
    });

    it('should throw NotFound if missing resolver in preview', async () => {
      mockRegistry.getResolver.mockReturnValue(null);
      await expect(
        service.renderPreview('body', {}, 'bad_context', '1', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
