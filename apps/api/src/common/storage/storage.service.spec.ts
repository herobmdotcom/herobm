import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should save and list images in a generic category', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test_logo.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 120,
      buffer: Buffer.from('test-png-bytes'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const saved = await service.saveImage('organization', mockFile);
    expect(saved.storagePath).toContain('organization/');
    expect(saved.fileName).toBe('test_logo.png');
    expect(saved.mimeType).toBe('image/png');

    const images = await service.listImages('organization');
    expect(images.some((img) => img.fileName === 'test_logo.png')).toBe(true);

    const resolved = service.resolveFilePath(saved.storagePath);
    expect(resolved.exists).toBe(true);
    expect(resolved.fullPath).toBeDefined();

    const deleted = await service.deleteFile(saved.storagePath);
    expect(deleted).toBe(true);
  });

  it('should save and delete images in reports category with subdirectory', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'chart.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 200,
      buffer: Buffer.from('test-jpg-bytes'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const saved = await service.saveImage('reports', mockFile, 'monthly');
    expect(saved.storagePath).toContain('reports/monthly/');

    const resolved = service.resolveFilePath(saved.storagePath);
    expect(resolved.exists).toBe(true);

    const deleted = await service.deleteFile(saved.storagePath);
    expect(deleted).toBe(true);
  });

  it('should not allow deleting files outside allowed directories', async () => {
    const deleted = await service.deleteFile('../../../etc/passwd');
    expect(deleted).toBe(false);
  });
});
