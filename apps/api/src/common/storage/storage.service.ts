import {
  Injectable,
  Logger,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { EnvService } from '../config/env.service';

export interface SavedFileMetadata {
  storagePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageRoot: string;

  constructor(@Optional() private readonly env?: EnvService) {
    const configuredPath = this.env?.storagePath || process.env.STORAGE_PATH;
    // Priority: Explicit env var -> Container standard path -> Monorepo paths
    const candidates = [
      configuredPath ? path.resolve(process.cwd(), configuredPath) : null,
      '/app/data/storage',
      path.resolve(process.cwd(), 'data/storage'),
      path.resolve(process.cwd(), '../../data/storage'),
      path.resolve(__dirname, '../../../../data/storage'),
    ].filter(Boolean) as string[];

    this.storageRoot =
      candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];

    this.ensureDirectory(this.storageRoot);
    this.ensureDirectory(path.join(this.storageRoot, 'products'));
    this.ensureDirectory(path.join(this.storageRoot, 'products', 'uploads'));
    this.ensureDirectory(path.join(this.storageRoot, 'products', 'abm')); // Kept for legacy fallback
  }

  public getStorageRoot(): string {
    return this.storageRoot;
  }

  private ensureDirectory(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (err) {
      this.logger.error(`Failed to ensure directory: ${dirPath}`, err);
    }
  }

  /**
   * Save an uploaded product image file to disk.
   */
  async saveProductImage(
    productId: string,
    file: Express.Multer.File,
  ): Promise<SavedFileMetadata> {
    const uploadDir = path.join(
      this.storageRoot,
      'products',
      'uploads',
      productId,
    );
    this.ensureDirectory(uploadDir);

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFileName = `${Date.now()}_${baseName}${ext}`;
    const destinationPath = path.join(uploadDir, safeFileName);

    await fs.promises.writeFile(destinationPath, file.buffer);

    const relativeStoragePath = `products/uploads/${productId}/${safeFileName}`;

    return {
      storagePath: relativeStoragePath,
      fileName: file.originalname,
      mimeType: file.mimetype,
      byteSize: file.size,
    };
  }

  /**
   * Safely resolve a relative storage path or product image path.
   * Handles path traversal prevention and case-insensitive fallback on Linux.
   */
  resolveFilePath(relativePath: string): {
    fullPath: string | null;
    exists: boolean;
  } {
    if (!relativePath || typeof relativePath !== 'string') {
      return { fullPath: null, exists: false };
    }

    // Clean leading slashes and normalize
    const cleanPath = relativePath.replace(/^(\/|\\)+/, '').replace(/\\/g, '/');

    // Build candidate paths to check:
    // 1. As provided (e.g. 'products/uploads/uuid/img.jpg' or 'products/img.jpg')
    // 2. Resolved within 'products/' if not already starting with 'products/' (e.g. 'img.jpg' -> 'products/img.jpg')
    // 3. Legacy fallback for 'abm/' -> 'products/abm/'
    const targetRelatives: string[] = [cleanPath];
    if (!cleanPath.startsWith('products/')) {
      targetRelatives.push(path.join('products', cleanPath));
    }
    if (cleanPath.startsWith('abm/')) {
      targetRelatives.push(path.join('products', cleanPath));
    }

    for (const targetRelative of targetRelatives) {
      const resolvedPath = path.resolve(this.storageRoot, targetRelative);

      // Prevent directory traversal attacks
      if (!resolvedPath.startsWith(this.storageRoot)) {
        throw new BadRequestException('Invalid file path');
      }

      // 1. Direct file check
      if (fs.existsSync(resolvedPath)) {
        const stat = fs.statSync(resolvedPath);
        if (stat.isFile()) {
          return { fullPath: resolvedPath, exists: true };
        }
      }

      // 2. Case-insensitive fallback lookup for Linux container environments
      const fallbackPath = this.findFileCaseInsensitive(
        this.storageRoot,
        targetRelative,
      );
      if (fallbackPath) {
        return { fullPath: fallbackPath, exists: true };
      }
    }

    return {
      fullPath: path.resolve(this.storageRoot, targetRelatives[0]),
      exists: false,
    };
  }

  /**
   * Delete an uploaded file if it exists inside the uploads directory.
   */
  async deleteFile(relativePath: string): Promise<boolean> {
    const { fullPath, exists } = this.resolveFilePath(relativePath);
    if (!exists || !fullPath) return false;

    // Safety guard: only allow deleting files in the uploads/ directory
    const uploadsDir = path.resolve(this.storageRoot, 'products', 'uploads');
    if (!fullPath.startsWith(uploadsDir)) {
      return false;
    }

    try {
      await fs.promises.unlink(fullPath);
      return true;
    } catch (err) {
      this.logger.warn(`Failed to delete file: ${fullPath}`, err);
      return false;
    }
  }

  /**
   * Case-insensitive file traversal helper.
   */
  private findFileCaseInsensitive(
    root: string,
    relPath: string,
  ): string | null {
    const parts = relPath.split(/[/\\]+/).filter(Boolean);
    let currentDir = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].toLowerCase();
      const isLast = i === parts.length - 1;

      try {
        const entries = fs.readdirSync(currentDir);
        const match = entries.find((e) => e.toLowerCase() === part);
        if (!match) return null;

        currentDir = path.join(currentDir, match);

        if (isLast) {
          const stat = fs.statSync(currentDir);
          return stat.isFile() ? currentDir : null;
        }
      } catch {
        return null;
      }
    }

    return null;
  }
}
