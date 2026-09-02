import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsWriteService } from './products-write.service';
import { StorageService } from '../common/storage/storage.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as fs from 'fs';
import * as path from 'path';

describe('ProductImages', () => {
  let controller: ProductsController;
  let storageService: StorageService;

  const mockProductService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const mockWriteService = {
    create: jest.fn(),
    update: jest.fn(),
    uploadImage: jest.fn(),
    removeImage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockProductService },
        { provide: ProductsWriteService, useValue: mockWriteService },
        StorageService,
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProductsController>(ProductsController);
    storageService = module.get<StorageService>(StorageService);
  });

  describe('StorageService', () => {
    it('should reject path traversal attempts with BadRequestException', () => {
      expect(() => {
        storageService.resolveFilePath('../../../etc/passwd');
      }).toThrow(BadRequestException);
    });

    it('should return exists: false for non-existent image files', () => {
      const result = storageService.resolveFilePath(
        'abm/non_existent_12345.jpg',
      );
      expect(result.exists).toBe(false);
    });

    it('should resolve files placed directly inside products/ directory without products/ prefix', async () => {
      const root = storageService.getStorageRoot();
      const testFile = path.join(root, 'products', 'test_unprefixed.jpg');
      fs.writeFileSync(testFile, 'test-image-bytes');

      try {
        const resolved = storageService.resolveFilePath('test_unprefixed.jpg');
        expect(resolved.exists).toBe(true);
        expect(resolved.fullPath).toBe(testFile);
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });

    it('should save and resolve uploaded product image correctly', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test_product.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 100,
        buffer: Buffer.from('fake-png-data'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const saved = await storageService.saveProductImage(
        'test-prod-uuid',
        mockFile,
      );
      expect(saved.storagePath).toContain('products/uploads/test-prod-uuid/');
      expect(saved.fileName).toBe('test_product.png');
      expect(saved.mimeType).toBe('image/png');

      const resolved = storageService.resolveFilePath(saved.storagePath);
      expect(resolved.exists).toBe(true);
      expect(resolved.fullPath).toBeDefined();

      // Clean up
      const deleted = await storageService.deleteFile(saved.storagePath);
      expect(deleted).toBe(true);
    });
  });

  describe('ProductsController.streamImage', () => {
    it('should throw NotFoundException if image does not exist', () => {
      const mockReq = { url: '/api/products/images/abm/missing.jpg' } as any;
      const mockRes = {
        setHeader: jest.fn(),
      } as any;

      expect(() => controller.streamImage(mockReq, mockRes)).toThrow(
        NotFoundException,
      );
    });

    it('should set Content-Type, Cache-Control, and pipe file when image exists', async () => {
      const root = storageService.getStorageRoot();
      const testFile = path.join(root, 'products', 'test_stream.jpg');
      fs.writeFileSync(testFile, 'image-binary-data');

      const { PassThrough } = await import('stream');
      const mockRes = new PassThrough() as any;
      mockRes.setHeader = jest.fn();

      const mockReq = { url: '/api/products/images/test_stream.jpg' } as any;

      try {
        const streamFinished = new Promise((resolve) =>
          mockRes.on('finish', resolve),
        );
        controller.streamImage(mockReq, mockRes);
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'image/jpeg',
        );
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Cache-Control',
          'public, max-age=86400, immutable',
        );
        await streamFinished;
      } finally {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    });
  });

  describe('ProductsController.uploadImage', () => {
    it('should reject non-image file mimetypes with BadRequestException', async () => {
      const mockFile = {
        mimetype: 'application/pdf',
        originalname: 'doc.pdf',
        size: 500,
        buffer: Buffer.from('pdf'),
      } as any;

      await expect(
        controller.uploadImage('prod-1', mockFile, {
          username: 'testuser',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload valid image and return updated product', async () => {
      const mockFile = {
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
        size: 500,
        buffer: Buffer.from('jpg-data'),
      } as any;

      mockWriteService.uploadImage.mockResolvedValue({
        imagePath: 'products/uploads/prod-1/photo.jpg',
      });
      mockProductService.findOne.mockResolvedValue({
        productId: 'prod-1',
        imagePath: 'products/uploads/prod-1/photo.jpg',
      });

      const result = await controller.uploadImage('prod-1', mockFile, {
        username: 'testuser',
      } as any);

      expect(mockWriteService.uploadImage).toHaveBeenCalledWith(
        'prod-1',
        mockFile,
        'testuser',
      );
      expect(result.imagePath).toBe('products/uploads/prod-1/photo.jpg');
    });
  });

  describe('ProductsController.removeImage', () => {
    it('should call removeImage on write service and return updated product', async () => {
      mockWriteService.removeImage.mockResolvedValue({ removed: true });
      mockProductService.findOne.mockResolvedValue({
        productId: 'prod-1',
        imagePath: null,
      });

      const result = await controller.removeImage('prod-1', {
        username: 'testuser',
      } as any);

      expect(mockWriteService.removeImage).toHaveBeenCalledWith(
        'prod-1',
        'testuser',
      );
      expect(result.imagePath).toBeNull();
    });
  });
});
