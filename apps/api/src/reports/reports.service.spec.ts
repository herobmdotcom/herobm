import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { ReportsRegistry } from './reports.registry';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { reports, reportHookAssignments } from '../drizzle/modbm-core-schema';
import { eq, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as child_process from 'child_process';

// Mock fs and child_process for Typst compilation testing
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn().mockImplementation((p, opts) => {
      if (p.toString().endsWith('.pdf')) return Buffer.from('fake-pdf-content');
      return actualFs.readFileSync(p, opts);
    }),
    unlinkSync: jest.fn(),
    existsSync: jest.fn().mockImplementation((p) => {
      if (
        p.toString().includes('au_standard') ||
        p.toString().includes('migrations')
      )
        return actualFs.existsSync(p);
      return true;
    }),
  };
});

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

describe('ReportsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: ReportsService;
  let mockRegistry: any;

  const TEST_REPORT_ID = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await pg.db.delete(reportHookAssignments);
    await pg.db.delete(reports);

    mockRegistry = {
      getResolver: jest.fn(),
      getRegisteredContexts: jest
        .fn()
        .mockReturnValue(['sales_order', 'purchase_order']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: ReportsRegistry, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('runHook', () => {
    it('should throw NotFoundException if hook assignment not found', async () => {
      await expect(
        service.runHook('print_invoice', '1', 'sales_order', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if report not found', async () => {
      // Use replica role to bypass FK constraint for this test case
      await pg.db.execute(sql`SET session_replication_role = 'replica'`);
      await pg.db.insert(reportHookAssignments).values({
        hookSlug: 'print_invoice',
        reportId: TEST_REPORT_ID,
        contextSlug: 'sales_order',
      });
      await pg.db.execute(sql`SET session_replication_role = 'origin'`);

      await expect(
        service.runHook('print_invoice', '1', 'sales_order', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should compile and return PDF and formatted filename', async () => {
      await pg.db.insert(reports).values({
        id: TEST_REPORT_ID,
        slug: 'inv',
        name: 'Invoice',
        template: 'body',
        outputNamePattern: '${orderNo}.pdf',
      });
      await pg.db.insert(reportHookAssignments).values({
        hookSlug: 'print_invoice',
        reportId: TEST_REPORT_ID,
        contextSlug: 'sales_order',
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
    });
  });

  describe('CRUD operations', () => {
    it('should return all reports', async () => {
      await pg.db.insert(reports).values({
        id: TEST_REPORT_ID,
        slug: 'r1',
        name: 'R1',
        template: '',
      });
      const res = await service.getReports();
      expect(res).toHaveLength(1);
    });

    it('should get a report by id', async () => {
      await pg.db.insert(reports).values({
        id: TEST_REPORT_ID,
        slug: 'r1',
        name: 'R1',
        template: '',
      });
      const res = await service.getReportById(TEST_REPORT_ID);
      expect(res.id).toBe(TEST_REPORT_ID);
    });

    it('should create a report', async () => {
      const res = await service.createReport({
        name: 'Test',
        slug: 'test',
        template: '',
      });
      expect(res.id).toBeDefined();
    });

    it('should update a report', async () => {
      await pg.db.insert(reports).values({
        id: TEST_REPORT_ID,
        slug: 'r1',
        name: 'R1',
        template: '',
      });
      const res = await service.updateReport(TEST_REPORT_ID, {
        name: 'New Name',
      });
      expect(res.name).toBe('New Name');
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
    });
  });
});
