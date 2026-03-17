import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrderReceptions,
  purchaseOrderReceptionLines,
  purchaseOrders,
  purchaseOrderLineItems,
} from '../drizzle/modbm-core-schema';
import { eq, or, ilike, desc, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class ReceptionsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async create(createDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      // Create Reception
      const receptionNumber = `REC-${randomUUID().substring(0, 8).toUpperCase()}`;

      const [reception] = await tx
        .insert(purchaseOrderReceptions)
        .values({
          receptionNumber,
          purchaseOrderId: createDto.purchaseOrderId,
          packingSlipNumber: createDto.packingSlipNumber,
          notes: createDto.notes,
          stateCode: 'received', // hardcoded to handled for now
          createdBy: userId,
        })
        .returning();

      // Create lines
      if (createDto.lines && createDto.lines.length > 0) {
        const lineValues = createDto.lines.map((line: any) => ({
          receptionId: reception.receptionId,
          purchaseOrderLineId: line.purchaseOrderLineId,
          quantityReceived: line.quantityReceived.toString(),
        }));

        await tx.insert(purchaseOrderReceptionLines).values(lineValues);

        // Update PO Line received quantities
        for (const line of createDto.lines) {
          const [poLine] = await tx
            .select()
            .from(purchaseOrderLineItems)
            .where(
              eq(
                purchaseOrderLineItems.purchaseOrderLineId,
                line.purchaseOrderLineId,
              ),
            );

          if (poLine) {
            const newTotal =
              Number(poLine.quantityReceived) + Number(line.quantityReceived);
            await tx
              .update(purchaseOrderLineItems)
              .set({ quantityReceived: newTotal.toString() })
              .where(
                eq(
                  purchaseOrderLineItems.purchaseOrderLineId,
                  line.purchaseOrderLineId,
                ),
              );
          }
        }

        // Check if all PO lines are fully received, update PO status if so
        // For simplicity, just marking the PO as 'received' if a reception is created
        await tx
          .update(purchaseOrders)
          .set({ stateCode: 'received', modifiedOn: new Date() })
          .where(eq(purchaseOrders.purchaseOrderId, createDto.purchaseOrderId));
      }

      return this.findOne(reception.receptionId, tx);
    });
  }

  async findAll(params: PaginationQuery) {
    const { page, limit, offset, searchTerm } = parsePagination(params);

    let conditions = undefined;
    if (searchTerm) {
      conditions = or(
        ilike(purchaseOrderReceptions.receptionNumber, searchTerm),
        ilike(purchaseOrderReceptions.packingSlipNumber, searchTerm),
      );
    }

    const data = await this.db
      .select({
        reception: purchaseOrderReceptions,
        purchaseOrder: purchaseOrders,
      })
      .from(purchaseOrderReceptions)
      .leftJoin(
        purchaseOrders,
        eq(
          purchaseOrderReceptions.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .where(conditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(purchaseOrderReceptions.createdOn));

    const [{ count }] = await this.db
      .select({ count: this.db.$count(purchaseOrderReceptions, conditions) })
      .from(purchaseOrderReceptions);

    return {
      data: data.map((d: any) => ({
        ...d.reception,
        purchaseOrderNumber: d.purchaseOrder?.orderNumber,
        vendorId: d.purchaseOrder?.vendorId,
      })),
      page,
      limit,
      total: Number(count),
    };
  }

  async findOne(id: string, tx: any = this.db) {
    const reception = await tx
      .select()
      .from(purchaseOrderReceptions)
      .where(eq(purchaseOrderReceptions.receptionId, id))
      .limit(1)
      .then((res: any[]) => res[0]);

    if (!reception) {
      throw new NotFoundException(`Reception ${id} not found`);
    }

    const lines = await tx
      .select({
        receptionLineId: purchaseOrderReceptionLines.receptionLineId,
        purchaseOrderLineId: purchaseOrderReceptionLines.purchaseOrderLineId,
        quantityReceived: purchaseOrderReceptionLines.quantityReceived,
        productId: purchaseOrderLineItems.productId,
        productDescription: purchaseOrderLineItems.productDescription,
      })
      .from(purchaseOrderReceptionLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseOrderReceptionLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .where(eq(purchaseOrderReceptionLines.receptionId, id));

    return {
      ...reception,
      lines,
    };
  }
}
