import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as fs from 'fs';
import * as path from 'path';

describe('StorageController', () => {
  let controller: StorageController;
  let mockStorageService: Partial<StorageService>;

  beforeEach(async () => {
    mockStorageService = {
      resolveFilePath: jest.fn(),
      getStorageRoot: jest.fn().mockReturnValue('/app/data/storage'),
      saveImage: jest.fn(),
      listImages: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [{ provide: StorageService, useValue: mockStorageService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StorageController>(StorageController);
  });

  describe('streamImage', () => {
    it('should throw NotFoundException if path is empty', () => {
      const req = { url: '/api/storage/images/' } as any;
      const res = {} as any;
      expect(() => controller.streamImage(req, res)).toThrow(NotFoundException);
    });

    it('should throw NotFoundException if file does not exist', () => {
      (mockStorageService.resolveFilePath as jest.Mock).mockReturnValue({
        fullPath: null,
        exists: false,
      });

      const req = {
        url: '/api/storage/images/organization/missing.png',
      } as any;
      const res = {} as any;
      expect(() => controller.streamImage(req, res)).toThrow(NotFoundException);
    });

    it('should set headers and stream file if it exists', async () => {
      const { PassThrough } = await import('stream');
      const tmpDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const testFile = path.join(tmpDir, 'test-storage-stream.png');
      fs.writeFileSync(testFile, 'fake-png-data');

      (mockStorageService.resolveFilePath as jest.Mock).mockReturnValue({
        fullPath: testFile,
        exists: true,
      });

      const req = { url: '/api/storage/images/organization/test.png' } as any;
      const res = new PassThrough() as any;
      res.setHeader = jest.fn();

      try {
        const finished = new Promise((resolve) => res.on('finish', resolve));
        controller.streamImage(req, res);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
        expect(res.setHeader).toHaveBeenCalledWith(
          'Cache-Control',
          'public, max-age=86400, immutable',
        );
        await finished;
      } finally {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
      }
    });
  });

  describe('uploadImage', () => {
    it('should throw BadRequestException if no file uploaded', async () => {
      await expect(controller.uploadImage(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid image format', async () => {
      const file = {
        mimetype: 'application/pdf',
        size: 100,
      } as Express.Multer.File;

      await expect(controller.uploadImage(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for file exceeding 5MB', async () => {
      const file = {
        mimetype: 'image/png',
        size: 6 * 1024 * 1024,
      } as Express.Multer.File;

      await expect(controller.uploadImage(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call storageService.saveImage with category', async () => {
      const file = {
        mimetype: 'image/png',
        size: 1000,
        originalname: 'chart.png',
      } as Express.Multer.File;

      const expectedResult = {
        storagePath: 'reports/123_chart.png',
        fileName: 'chart.png',
        mimeType: 'image/png',
        byteSize: 1000,
      };
      (mockStorageService.saveImage as jest.Mock).mockResolvedValue(
        expectedResult,
      );

      const result = await controller.uploadImage(file, 'reports');
      expect(mockStorageService.saveImage).toHaveBeenCalledWith(
        'reports',
        file,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('listImages', () => {
    it('should call storageService.listImages with category', async () => {
      const mockImages = [
        {
          storagePath: 'reports/chart1.png',
          fileName: 'chart1.png',
          mimeType: 'image/png',
          byteSize: 500,
        },
      ];
      (mockStorageService.listImages as jest.Mock).mockResolvedValue(
        mockImages,
      );

      const result = await controller.listImages('reports');
      expect(mockStorageService.listImages).toHaveBeenCalledWith('reports');
      expect(result).toEqual(mockImages);
    });
  });

  describe('deleteImage', () => {
    it('should throw NotFoundException if path is empty', async () => {
      const req = { url: '/api/storage/images/' } as any;
      await expect(controller.deleteImage(req)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if storageService returns false', async () => {
      (mockStorageService.deleteFile as jest.Mock).mockResolvedValue(false);
      const req = {
        url: '/api/storage/images/organization/missing.png',
      } as any;
      await expect(controller.deleteImage(req)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return { success: true } when deletion succeeds', async () => {
      (mockStorageService.deleteFile as jest.Mock).mockResolvedValue(true);
      const req = { url: '/api/storage/images/organization/logo.png' } as any;
      const result = await controller.deleteImage(req);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        'organization/logo.png',
      );
      expect(result).toEqual({ success: true });
    });
  });
});
