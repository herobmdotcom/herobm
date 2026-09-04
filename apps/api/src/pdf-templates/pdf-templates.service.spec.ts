import { Test, TestingModule } from '@nestjs/testing';
import { PdfTemplatesService } from './pdf-templates.service';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { CASBIN_ENFORCER } from '../auth/casbin.provider';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  pdfTemplates,
  pdfTemplateHooks,
  organization,
} from '@herobm/db-schema';
import { eq, sql } from 'drizzle-orm';
import { StorageService } from '../common/storage/storage.service';
import * as fs from 'fs';
import * as child_process from 'child_process';

jest.mock('../common/utils/security.util', () => ({
  verifySystemHealth: jest.fn().mockResolvedValue(true),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  hashSync: jest.fn(),
}));

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
    copyFileSync: jest.fn(),
    readdirSync: jest.fn().mockImplementation((p, opts) => {
      if (p.toString().includes('migrations')) {
        return actualFs.readdirSync(p, opts);
      }
      return [];
    }),
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
      (err as Error & { stderr?: string }).stderr = 'Compiler failed';
      cb(err, '', 'Compiler failed');
    } else {
      cb(null, 'Compiled', '');
    }
  }),
}));

describe('PdfTemplatesService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: PdfTemplatesService;
  let mockRegistry: any;
  let mockEnforcer: any;
  let mockStorageService: any;

  const TEST_REPORT_ID = '00000000-0000-4000-8000-000000000001';

  beforeEach(async () => {
    await pg.db.delete(pdfTemplateHooks);
    await pg.db.delete(pdfTemplates);
    await pg.db.delete(organization);

    mockRegistry = {
      getProvider: jest.fn(),
      getRegisteredContexts: jest
        .fn()
        .mockReturnValue(['sales_order', 'purchase_order']),
    };

    mockEnforcer = {
      enforce: jest.fn().mockResolvedValue(true),
    };

    mockStorageService = {
      resolveFilePath: jest.fn().mockImplementation((relPath: string) => ({
        fullPath: `/data/storage/${relPath}`,
        exists: true,
      })),
      getStorageRoot: jest.fn().mockReturnValue('/data/storage'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfTemplatesService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: DataSourcesRegistry, useValue: mockRegistry },
        { provide: CASBIN_ENFORCER, useValue: mockEnforcer },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<PdfTemplatesService>(PdfTemplatesService);
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
      await pg.db.insert(pdfTemplateHooks).values({
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
      await pg.db.insert(pdfTemplates).values({
        id: TEST_REPORT_ID,
        slug: 'inv',
        name: 'Invoice',
        template: 'body',
        outputNamePattern: '${orderNo}.pdf',
      });
      await pg.db.insert(pdfTemplateHooks).values({
        hookSlug: 'print_invoice',
        reportId: TEST_REPORT_ID,
        contextSlug: 'sales_order',
      });

      const mockResolver = {
        requiredPermissions: [{ resource: 'sales_order', action: 'read' }],
        resolveData: jest.fn().mockResolvedValue({ orderNo: 'ORD-123' }),
      };
      mockRegistry.getProvider.mockReturnValue(mockResolver);

      const user = { role: 'admin' };
      const result = await service.runHook(
        'print_invoice',
        '1',
        'sales_order',
        user,
      );

      expect(mockEnforcer.enforce).toHaveBeenCalledWith(
        'admin',
        'sales_order',
        'read',
      );
      expect(result.fileName).toBe('ORD-123.pdf');
      expect(result.pdfBuffer).toBeDefined();
    });

    it('should throw ForbiddenException if user lacks required permission', async () => {
      await pg.db.insert(pdfTemplates).values({
        id: TEST_REPORT_ID,
        slug: 'inv2',
        name: 'Invoice2',
        template: 'body',
      });
      await pg.db.insert(pdfTemplateHooks).values({
        hookSlug: 'print_invoice_2',
        reportId: TEST_REPORT_ID,
        contextSlug: 'sales_order',
      });

      const mockResolver = {
        requiredPermissions: [{ resource: 'sales_order', action: 'read' }],
        resolveData: jest.fn().mockResolvedValue({ orderNo: 'ORD-123' }),
      };
      mockRegistry.getProvider.mockReturnValue(mockResolver);
      mockEnforcer.enforce.mockResolvedValue(false);

      await expect(
        service.runHook('print_invoice_2', '1', 'sales_order', {
          role: 'guest',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockEnforcer.enforce).toHaveBeenCalledWith(
        'guest',
        'sales_order',
        'read',
      );
    });
  });

  describe('CRUD operations', () => {
    it('should return all reports', async () => {
      await pg.db.insert(pdfTemplates).values({
        id: TEST_REPORT_ID,
        slug: 'r1',
        name: 'R1',
        template: '',
      });
      const res = await service.getReports();
      expect(res).toHaveLength(1);
    });

    it('should get a report by id', async () => {
      await pg.db.insert(pdfTemplates).values({
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
      await pg.db.insert(pdfTemplates).values({
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
        requiredPermissions: [{ resource: 'sales_order', action: 'read' }],
        resolveData: jest.fn().mockResolvedValue({ test: true }),
      };
      mockRegistry.getProvider.mockReturnValue(mockResolver);

      const result = await service.renderPreview(
        'body',
        {},
        'sales_order',
        '1',
        { role: 'admin' },
      );
      expect(mockEnforcer.enforce).toHaveBeenCalledWith(
        'admin',
        'sales_order',
        'read',
      );
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if renderPreview lacks permission', async () => {
      const mockResolver = {
        requiredPermissions: [{ resource: 'sales_order', action: 'read' }],
        resolveData: jest.fn().mockResolvedValue({ test: true }),
      };
      mockRegistry.getProvider.mockReturnValue(mockResolver);
      mockEnforcer.enforce.mockResolvedValue(false);

      await expect(
        service.renderPreview('body', {}, 'sales_order', '1', {
          role: 'guest',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should stage logo file and include _org.logoFile in Typst data when logo is configured', async () => {
      await pg.db.insert(organization).values({
        name: 'Acme Test Corp',
        logoUrl: 'organization/acme_logo.png',
      });

      const result = await service.renderPreview('body', { test: true });
      expect(result).toBeDefined();

      expect(mockStorageService.resolveFilePath).toHaveBeenCalledWith(
        'organization/acme_logo.png',
      );
      expect(fs.copyFileSync).toHaveBeenCalled();

      // Verify that the written JSON data contains _org with logoFile
      const jsonCalls = (fs.writeFileSync as jest.Mock).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].endsWith('.json'),
      );
      const writeCall = jsonCalls[jsonCalls.length - 1];
      expect(writeCall).toBeDefined();
      const writtenJson = JSON.parse(writeCall[1]);
      expect(writtenJson._org).toBeDefined();
      expect(writtenJson._org.name).toBe('Acme Test Corp');
      expect(writtenJson._org.logoFile).toMatch(/_logo\.png$/);
    });

    it('should not include logoFile when organization has no logoUrl', async () => {
      await pg.db.insert(organization).values({
        name: 'Plain Corp',
        logoUrl: '',
      });

      const result = await service.renderPreview('body', { test: true });
      expect(result).toBeDefined();

      const jsonCalls = (fs.writeFileSync as jest.Mock).mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].endsWith('.json'),
      );
      const writeCall = jsonCalls[jsonCalls.length - 1];
      expect(writeCall).toBeDefined();
      const writtenJson = JSON.parse(writeCall[1]);
      expect(writtenJson._org).toBeDefined();
      expect(writtenJson._org.logoFile).toBeUndefined();
    });
  });
});
