import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';

describe('ReportsController', () => {
  let controller: ReportsController;
  let mockReportsService: any;
  let mockRes: Partial<Response>;

  beforeEach(async () => {
    mockReportsService = {
      runHook: jest.fn().mockResolvedValue({
        pdfBuffer: Buffer.from('pdf'),
        fileName: 'test.pdf',
      }),
      getReports: jest.fn().mockResolvedValue([{ id: '1' }]),
      getHooksList: jest.fn().mockResolvedValue([{ slug: 'hook1' }]),
      getRandomIdForContext: jest.fn().mockResolvedValue('random-id'),
      getReportById: jest.fn().mockResolvedValue({ id: '1' }),
      createReport: jest.fn().mockResolvedValue({ id: 'new-id' }),
      updateReport: jest.fn().mockResolvedValue({ id: '1', name: 'Updated' }),
      renderPreview: jest.fn().mockResolvedValue(Buffer.from('preview-pdf')),
    };

    mockRes = {
      set: jest.fn(),
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockReportsService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  describe('runHook', () => {
    it('should return PDF response on valid parameters', async () => {
      await controller.runHook(
        'hook1',
        '123',
        'sales',
        { user: {} },
        mockRes as Response,
      );

      expect(mockReportsService.runHook).toHaveBeenCalledWith(
        'hook1',
        '123',
        'sales',
        {},
        undefined,
      );
      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="test.pdf"',
        }),
      );
      expect(mockRes.send).toHaveBeenCalledWith(Buffer.from('pdf'));
    });

    it('should throw UnauthorizedException on missing query params', async () => {
      await expect(
        controller.runHook(
          'hook1',
          '',
          'sales',
          { user: {} },
          mockRes as Response,
        ),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        controller.runHook(
          'hook1',
          '123',
          '',
          { user: {} },
          mockRes as Response,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('CRUD Endpoints', () => {
    it('should return all reports', async () => {
      const res = await controller.getAllReports();
      expect(res.data).toHaveLength(1);
    });

    it('should return all hooks', async () => {
      const res = await controller.getHooks();
      expect(res.data).toHaveLength(1);
    });

    it('should return a random context id', async () => {
      const res = await controller.getRandomId('sales');
      expect(res.data.id).toBe('random-id');
    });

    it('should return a specific report', async () => {
      const res = await controller.getReport('1');
      expect(res.data.id).toBe('1');
    });

    it('should create a report', async () => {
      const res = await controller.createReport({
        name: 'T',
        slug: 't',
        template: '',
      });
      expect(res.data.id).toBe('new-id');
    });

    it('should update a report', async () => {
      const res = await controller.updateReport('1', { name: 'U' });
      expect(res.data.name).toBe('Updated');
    });
  });

  describe('preview', () => {
    it('should generate preview pdf buffer and send', async () => {
      await controller.preview(
        { template: 't', mockData: {} },
        { user: {} },
        mockRes as Response,
      );

      expect(mockReportsService.renderPreview).toHaveBeenCalledWith(
        't',
        {},
        undefined,
        undefined,
        {},
      );
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
      });
      expect(mockRes.send).toHaveBeenCalledWith(Buffer.from('preview-pdf'));
    });
  });
});
