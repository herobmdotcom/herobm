import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, like } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  products as coreProducts,
  productUoms,
  productSuppliers,
  productComponents,
} from '@herobm/db-schema';
import { PRODUCT_STATE, EntityType, EventType } from '@herobm/shared';
import { emitEvent } from '../common/emit-event';
import { CopyProductDto } from './dto';

@Injectable()
export class ProductCopyService {
  private readonly logger = new Logger(ProductCopyService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Copy an existing product to a new instance.
   */
  async copy(
    productId: string,
    dto: CopyProductDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;

    const [source] = await db
      .select()
      .from(coreProducts)
      .where(eq(coreProducts.productId, productId))
      .limit(1);

    if (!source) {
      throw new NotFoundException(`Product '${productId}' not found`);
    }

    let targetProductNumber = dto?.productNumber?.trim();
    if (targetProductNumber) {
      const [existingSku] = await db
        .select({ id: coreProducts.productId })
        .from(coreProducts)
        .where(eq(coreProducts.productNumber, targetProductNumber))
        .limit(1);

      if (existingSku) {
        throw new BadRequestException(
          `Product with number '${targetProductNumber}' already exists`,
        );
      }
    } else {
      const prefix = `${source.productNumber}-COPY`;
      const existingMatches = await db
        .select({ productNumber: coreProducts.productNumber })
        .from(coreProducts)
        .where(like(coreProducts.productNumber, `${prefix}%`));

      const existingSkus = new Set(existingMatches.map((m) => m.productNumber));

      if (!existingSkus.has(prefix)) {
        targetProductNumber = prefix;
      } else {
        let counter = 2;
        while (existingSkus.has(`${prefix}-${counter}`)) {
          counter++;
        }
        targetProductNumber = `${prefix}-${counter}`;
      }
    }

    const targetName = dto?.name?.trim() || `${source.name} (Copy)`;

    const runInTx = async (innerTx: DrizzleDB) => {
      // 1. Insert product record
      const [newProduct] = await innerTx
        .insert(coreProducts)
        .values({
          productNumber: targetProductNumber,
          name: targetName,
          productType: source.productType,
          structureType: source.structureType,
          productGroupId: source.productGroupId,
          barcode: null,
          listPrice: source.listPrice,
          standardCost: source.standardCost,
          tradePrice: source.tradePrice,
          priceLevel3: source.priceLevel3,
          priceLevel4: source.priceLevel4,
          weightedAverageCost: null,
          weight: source.weight,
          alternateInvoiceDescription: source.alternateInvoiceDescription,
          boxQuantity: source.boxQuantity,
          baseUom: source.baseUom,
          purchaseTaxCategoryId: source.purchaseTaxCategoryId,
          salesTaxCategoryId: source.salesTaxCategoryId,
          externalTaxCode: source.externalTaxCode,
          alternateProductNumber: null,
          imagePath: source.imagePath,
          stateCode: PRODUCT_STATE.ACTIVE,
          notes: source.notes,
          source: 'app',
          createdBy: actor,
        })
        .returning();

      // 2. Copy product UOM conversions
      const sourceUoms = await innerTx
        .select()
        .from(productUoms)
        .where(eq(productUoms.productId, productId));

      const uomIdMap = new Map<string, string>();
      for (const uom of sourceUoms) {
        const [newUom] = await innerTx
          .insert(productUoms)
          .values({
            productId: newProduct.productId,
            uomCode: uom.uomCode,
            ratio: uom.ratio,
            barcode: null,
          })
          .returning();
        uomIdMap.set(uom.productUomId, newUom.productUomId);
      }

      // If source had defaultSalesUomId or defaultPurchaseUomId pointing to custom UOMs, link them
      const newDefaultSalesUomId = source.defaultSalesUomId
        ? uomIdMap.get(source.defaultSalesUomId) || null
        : null;
      const newDefaultPurchaseUomId = source.defaultPurchaseUomId
        ? uomIdMap.get(source.defaultPurchaseUomId) || null
        : null;

      let finalProduct = newProduct;
      if (newDefaultSalesUomId || newDefaultPurchaseUomId) {
        const [updatedProduct] = await innerTx
          .update(coreProducts)
          .set({
            defaultSalesUomId: newDefaultSalesUomId,
            defaultPurchaseUomId: newDefaultPurchaseUomId,
            modifiedOn: new Date(),
          })
          .where(eq(coreProducts.productId, newProduct.productId))
          .returning();
        if (updatedProduct) {
          finalProduct = updatedProduct;
        }
      }

      // 3. Copy active product suppliers
      const sourceSuppliers = await innerTx
        .select()
        .from(productSuppliers)
        .where(
          and(
            eq(productSuppliers.productId, productId),
            eq(productSuppliers.stateCode, PRODUCT_STATE.ACTIVE),
          ),
        );

      if (sourceSuppliers.length > 0) {
        await innerTx.insert(productSuppliers).values(
          sourceSuppliers.map((supplier) => ({
            productId: newProduct.productId,
            vendorId: supplier.vendorId,
            supplierPartNumber: supplier.supplierPartNumber,
            costPrice: supplier.costPrice,
            discountPercent: supplier.discountPercent,
            isPreferred: supplier.isPreferred,
            effectiveFrom: supplier.effectiveFrom,
            effectiveTo: supplier.effectiveTo,
            stateCode: PRODUCT_STATE.ACTIVE,
            source: 'app',
            createdBy: actor,
          })),
        );
      }

      // 4. Copy kit components if structureType is kit
      if (source.structureType === 'kit') {
        const sourceComponents = await innerTx
          .select()
          .from(productComponents)
          .where(eq(productComponents.parentProductId, productId));

        if (sourceComponents.length > 0) {
          await innerTx.insert(productComponents).values(
            sourceComponents.map((comp) => ({
              parentProductId: newProduct.productId,
              childProductId: comp.childProductId,
              parentQuantity: comp.parentQuantity,
              quantity: comp.quantity,
              sequenceNumber: comp.sequenceNumber,
              fractionalBehavior: comp.fractionalBehavior,
            })),
          );
        }
      }

      // 5. Audit log
      await emitEvent(innerTx, {
        entityType: EntityType.PRODUCT,
        entityId: newProduct.productId,
        eventType: EventType.CREATED,
        entityDisplayName: newProduct.name,
        payload: {
          copiedFromProductId: source.productId,
          copiedFromProductNumber: source.productNumber,
          productNumber: newProduct.productNumber,
          name: newProduct.name,
        },
        actor,
      });

      return finalProduct;
    };

    const result = tx ? await runInTx(tx) : await this.db.transaction(runInTx);
    this.logger.log(
      `Product copied: ${source.productNumber} -> ${result.productNumber} (ID: ${result.productId}) by ${actor}`,
    );
    return result;
  }
}
