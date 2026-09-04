import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { StorageService } from '../common/storage/storage.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { organization } from '@herobm/db-schema';
import { BadRequestException } from '@nestjs/common';

describe('OrganizationService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: OrganizationService;
  let mockStorageService: any;

  beforeEach(async () => {
    mockStorageService = {
      saveImage: jest.fn().mockResolvedValue({
        storagePath: 'organization/12345_my_logo.png',
        fileName: 'my_logo.png',
        mimeType: 'image/png',
        byteSize: 1024,
      }),
      deleteFile: jest.fn().mockResolvedValue(true),
      resolveFilePath: jest.fn().mockReturnValue({
        fullPath: '/data/storage/organization/12345_my_logo.png',
        exists: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    await pg.db.delete(organization);
  });

  describe('get', () => {
    it('should return default object when no organization exists', async () => {
      const org = await service.get();
      expect(org).toBeDefined();
      expect(org.name).toBe('');
      expect(org.logoUrl).toBe('');
    });

    it('should return existing organization when present', async () => {
      await pg.db.insert(organization).values({
        name: 'Acme Corp',
        logoUrl: 'organization/acme_logo.png',
      });
      const org = await service.get();
      expect(org.name).toBe('Acme Corp');
      expect(org.logoUrl).toBe('organization/acme_logo.png');
    });
  });

  describe('update', () => {
    it('should throw BadRequestException when company name is missing', async () => {
      await expect(
        service.update({ name: '' } as any, 'testuser'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should insert organization if non-existent', async () => {
      const result = await service.update(
        { name: 'New Corp', city: 'Sydney' } as any,
        'testuser',
      );
      expect(result.name).toBe('New Corp');
      expect(result.city).toBe('Sydney');
    });

    it('should update organization if already exists', async () => {
      await service.update({ name: 'Initial Corp' } as any, 'testuser');
      const updated = await service.update(
        { name: 'Updated Corp', city: 'Melbourne' } as any,
        'testuser',
      );
      expect(updated.name).toBe('Updated Corp');
      expect(updated.city).toBe('Melbourne');
    });
  });

  describe('uploadLogo', () => {
    it('should reject invalid mime type', async () => {
      const file = {
        mimetype: 'text/plain',
        size: 100,
        originalname: 'test.txt',
      } as Express.Multer.File;

      await expect(service.uploadLogo(file, 'testuser')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject files exceeding 5MB', async () => {
      const file = {
        mimetype: 'image/png',
        size: 6 * 1024 * 1024,
        originalname: 'large.png',
      } as Express.Multer.File;

      await expect(service.uploadLogo(file, 'testuser')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should save logo and update organization logoUrl', async () => {
      const file = {
        mimetype: 'image/png',
        size: 2048,
        originalname: 'logo.png',
      } as Express.Multer.File;

      const result = await service.uploadLogo(file, 'testuser');
      expect(mockStorageService.saveImage).toHaveBeenCalledWith(
        'organization',
        file,
      );
      expect(result.logoUrl).toBe('organization/12345_my_logo.png');

      const stored = await service.get();
      expect(stored.logoUrl).toBe('organization/12345_my_logo.png');
    });

    it('should delete previous logo if already configured', async () => {
      await pg.db.insert(organization).values({
        name: 'Acme Corp',
        logoUrl: 'organization/old_logo.png',
      });

      const file = {
        mimetype: 'image/png',
        size: 2048,
        originalname: 'new_logo.png',
      } as Express.Multer.File;

      await service.uploadLogo(file, 'testuser');
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        'organization/old_logo.png',
      );
    });
  });

  describe('removeLogo', () => {
    it('should delete logo file and clear logoUrl', async () => {
      await pg.db.insert(organization).values({
        name: 'Acme Corp',
        logoUrl: 'organization/my_logo.png',
      });

      const updated = await service.removeLogo('testuser');
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        'organization/my_logo.png',
      );
      expect(updated.logoUrl).toBe('');

      const stored = await service.get();
      expect(stored.logoUrl).toBe('');
    });
  });
});
