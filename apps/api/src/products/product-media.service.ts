import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { products as coreProducts, productImages } from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { StorageService } from '../common/storage/storage.service';

@Injectable()
export class ProductMediaService {
  private readonly logger = new Logger(ProductMediaService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Upload and set the primary image for a product.
   */
  async uploadImage(
    productId: string,
    file: Express.Multer.File,
    actor: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No image file provided');
    }

    const [product] = await this.db
      .select()
      .from(coreProducts)
      .where(eq(coreProducts.productId, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product '${productId}' not found`);
    }

    const saved = await this.storageService.saveProductImage(productId, file);

    await this.db.transaction(async (tx) => {
      // 1. Update product.image_path
      await tx
        .update(coreProducts)
        .set({
          imagePath: saved.storagePath,
          modifiedOn: new Date(),
        })
        .where(eq(coreProducts.productId, productId));

      // 2. Insert into product_images table
      await tx.insert(productImages).values({
        productId,
        storagePath: saved.storagePath,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        byteSize: saved.byteSize,
        isPrimary: true,
        sortOrder: 0,
        createdBy: actor,
      });

      // 3. Emit audit event
      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.UPDATED,
        entityDisplayName: product.name,
        payload: {
          action: 'image_uploaded',
          imagePath: saved.storagePath,
          fileName: saved.fileName,
        },
        actor,
      });
    });

    return {
      imagePath: saved.storagePath,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      byteSize: saved.byteSize,
    };
  }

  /**
   * Remove the image for a product.
   */
  async removeImage(productId: string, actor: string) {
    const [product] = await this.db
      .select()
      .from(coreProducts)
      .where(eq(coreProducts.productId, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product '${productId}' not found`);
    }

    const oldPath = product.imagePath;

    await this.db.transaction(async (tx) => {
      await tx
        .update(coreProducts)
        .set({
          imagePath: null,
          modifiedOn: new Date(),
        })
        .where(eq(coreProducts.productId, productId));

      await tx
        .delete(productImages)
        .where(eq(productImages.productId, productId));

      await emitEvent(tx, {
        entityType: EntityType.PRODUCT,
        entityId: productId,
        eventType: EventType.UPDATED,
        entityDisplayName: product.name,
        payload: { action: 'image_removed', previousImagePath: oldPath },
        actor,
      });
    });

    // If it was an uploaded file, delete it from storage
    if (oldPath && oldPath.includes('uploads/')) {
      await this.storageService.deleteFile(oldPath);
    }

    return { removed: true };
  }
}
