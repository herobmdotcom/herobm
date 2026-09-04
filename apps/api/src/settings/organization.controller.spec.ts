import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { StorageService } from '../common/storage/storage.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as fs from 'fs';
import * as path from 'path';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let mockOrgService: Partial<OrganizationService>;
  let mockStorageService: Partial<StorageService>;

  beforeEach(async () => {
    mockOrgService = {
      get: jest.fn(),
      update: jest.fn(),
      uploadLogo: jest.fn(),
      removeLogo: jest.fn(),
    };

    mockStorageService = {
      resolveFilePath: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [
        { provide: OrganizationService, useValue: mockOrgService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrganizationController>(OrganizationController);
  });

  describe('uploadLogo', () => {
    it('should delegate to orgService.uploadLogo', async () => {
      const mockFile = { originalname: 'logo.png' } as Express.Multer.File;
      const mockUser = { username: 'admin' } as any;
      const expectedResult = {
        organizationId: '1',
        logoUrl: 'organization/logo.png',
      } as any;

      (mockOrgService.uploadLogo as jest.Mock).mockResolvedValue(
        expectedResult,
      );

      const result = await controller.uploadLogo(mockFile, mockUser);
      expect(mockOrgService.uploadLogo).toHaveBeenCalledWith(mockFile, 'admin');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('removeLogo', () => {
    it('should delegate to orgService.removeLogo', async () => {
      const mockUser = { username: 'admin' } as any;
      const expectedResult = { organizationId: '1', logoUrl: '' } as any;

      (mockOrgService.removeLogo as jest.Mock).mockResolvedValue(
        expectedResult,
      );

      const result = await controller.removeLogo(mockUser);
      expect(mockOrgService.removeLogo).toHaveBeenCalledWith('admin');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('streamLogo', () => {
    it('should throw NotFoundException if logo is not configured', async () => {
      (mockOrgService.get as jest.Mock).mockResolvedValue({ logoUrl: '' });
      const mockRes = {} as any;

      await expect(controller.streamLogo(mockRes)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if logo file does not exist on disk', async () => {
      (mockOrgService.get as jest.Mock).mockResolvedValue({
        logoUrl: 'organization/missing.png',
      });
      (mockStorageService.resolveFilePath as jest.Mock).mockReturnValue({
        fullPath: null,
        exists: false,
      });

      const mockRes = {} as any;
      await expect(controller.streamLogo(mockRes)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should set headers and stream logo when it exists', async () => {
      const { PassThrough } = await import('stream');
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const testFile = path.join(tmpDir, 'test-logo-stream.png');
      fs.writeFileSync(testFile, 'fake-logo-bytes');

      (mockOrgService.get as jest.Mock).mockResolvedValue({
        logoUrl: 'organization/test-logo-stream.png',
      });
      (mockStorageService.resolveFilePath as jest.Mock).mockReturnValue({
        fullPath: testFile,
        exists: true,
      });

      const mockRes = new PassThrough() as any;
      mockRes.setHeader = jest.fn();

      try {
        const finished = new Promise((resolve) =>
          mockRes.on('finish', resolve),
        );
        await controller.streamLogo(mockRes);
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'image/png',
        );
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Cache-Control',
          'public, max-age=86400, immutable',
        );
        await finished;
      } finally {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      }
    });
  });
});
