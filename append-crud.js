const fs = require('fs');

let content = fs.readFileSync('apps/api/src/orders/transfers/transfers.service.ts', 'utf8');

// Replace imports
content = content.replace(
  /import \{ eq, and, inArray, sum, sql, desc \} from 'drizzle-orm';/,
  "import { eq, and, inArray, sum, sql, desc, or, ilike, alias } from 'drizzle-orm';\nimport { PaginationQuery, parsePagination } from '../../common/pagination';\nimport { CreateTransferOrderDto, UpdateTransferOrderDto, CreateTransferOrderLineDto, UpdateTransferOrderLineDto } from './dto';"
);

let code = `
  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async findAll(query?: PaginationQuery) {
    const { page, limit, offset, searchTerm, states } = parsePagination(query);

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(transferOrders.orderNumber, \`%\${searchTerm}%\`),
          ilike(transferOrders.notes, \`%\${searchTerm}%\`),
        ),
      );
    }

    if (states && states.length > 0) {
      if (states.length === 1) {
        conditions.push(eq(transferOrders.stateCode, states[0] as any));
      } else {
        conditions.push(inArray(transferOrders.stateCode, states as any[]));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count }] = await this.db
      .select({ count: sql<number>\`count(*)\` })
      .from(transferOrders)
      .where(whereClause);

    const destLoc = alias(locations, 'destLoc');
    const sourceLoc = alias(locations, 'sourceLoc');

    const rows = await this.db
      .select({
        id: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        stateCode: transferOrders.stateCode,
        sourceLocationId: transferOrders.sourceLocationId,
        sourceLocationName: sourceLoc.name,
        destinationLocationId: transferOrders.destinationLocationId,
        destinationLocationName: destLoc.name,
        createdBy: transferOrders.createdBy,
        createdOn: transferOrders.createdOn,
        notes: transferOrders.notes,
      })
      .from(transferOrders)
      .leftJoin(sourceLoc, eq(transferOrders.sourceLocationId, sourceLoc.locationId))
      .leftJoin(destLoc, eq(transferOrders.destinationLocationId, destLoc.locationId))
      .where(whereClause)
      .orderBy(desc(transferOrders.createdOn))
      .limit(limit)
      .offset(offset);

    return { data: rows, page, limit, total: Number(count) };
  }

  async findOne(id: string) {
    const destLoc = alias(locations, 'destLoc');
    const sourceLoc = alias(locations, 'sourceLoc');

    const [order] = await this.db
      .select({
        id: transferOrders.transferOrderId,
        transferOrderId: transferOrders.transferOrderId,
        orderNumber: transferOrders.orderNumber,
        stateCode: transferOrders.stateCode,
        sourceLocationId: transferOrders.sourceLocationId,
        sourceLocationName: sourceLoc.name,
        destinationLocationId: transferOrders.destinationLocationId,
        destinationLocationName: destLoc.name,
        createdBy: transferOrders.createdBy,
        createdOn: transferOrders.createdOn,
        notes: transferOrders.notes,
      })
      .from(transferOrders)
      .leftJoin(sourceLoc, eq(transferOrders.sourceLocationId, sourceLoc.locationId))
      .leftJoin(destLoc, eq(transferOrders.destinationLocationId, destLoc.locationId))
      .where(eq(transferOrders.transferOrderId, id));

    if (!order) {
      throw new NotFoundException('Transfer Order not found');
    }

    const lines = await this.db
      .select({
        id: transferOrderLines.transferOrderLineId,
        transferOrderLineId: transferOrderLines.transferOrderLineId,
        productId: transferOrderLines.productId,
        productNumber: coreProducts.productNumber,
        productDescription: coreProducts.name,
        quantity: transferOrderLines.quantity,
        quantityShipped: transferOrderLines.quantityShipped,
        quantityReceived: transferOrderLines.quantityReceived,
      })
      .from(transferOrderLines)
      .innerJoin(coreProducts, eq(transferOrderLines.productId, coreProducts.productId))
      .where(eq(transferOrderLines.transferOrderId, id));

    return { ...order, lines };
  }

  async create(dto: CreateTransferOrderDto, actor: string) {
    return await this.db.transaction(async (tx) => {
      const prefix = \`TO-\${new Date().toISOString().split('T')[0].replace(/-/g, '')}-\`;
      const lastOrder = await tx
        .select({ orderNumber: transferOrders.orderNumber })
        .from(transferOrders)
        .where(sql\`\${transferOrders.orderNumber} LIKE \${prefix + '%'}\`)
        .orderBy(desc(transferOrders.orderNumber))
        .limit(1);

      let nextNum = 1;
      if (lastOrder.length > 0) {
        const parts = lastOrder[0].orderNumber.split('-');
        nextNum = parseInt(parts[2], 10) + 1;
      }
      const orderNumber = \`\${prefix}\${String(nextNum).padStart(3, '0')}\`;
      const transferOrderId = uuidv4();

      await tx.insert(transferOrders).values({
        transferOrderId,
        orderNumber,
        sourceLocationId: dto.sourceLocationId,
        destinationLocationId: dto.destinationLocationId,
        notes: dto.notes,
        stateCode: TRANSFER_ORDER_STATE.CONFIRMED,
        createdBy: actor,
      });

      if (dto.lines && dto.lines.length > 0) {
        const linesInsert = dto.lines.map((l) => ({
          transferOrderLineId: uuidv4(),
          transferOrderId,
          productId: l.productId,
          quantity: l.quantity,
        }));
        await tx.insert(transferOrderLines).values(linesInsert);
      }

      await emitEvent(tx as any, {
        aggregateType: AggregateType.TRANSFER_ORDER,
        aggregateId: transferOrderId,
        eventType: EventType.CREATED,
        payload: { orderNumber },
        actor,
      });

      return { id: transferOrderId, transferOrderId, orderNumber };
    });
  }

  async update(id: string, dto: UpdateTransferOrderDto, actor: string) {
    const [existing] = await this.db
      .select({ stateCode: transferOrders.stateCode })
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, id));

    if (!existing) throw new NotFoundException('Transfer order not found');

    if (existing.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED) {
      throw new BadRequestException('Cannot edit an order that is already in progress');
    }

    const updates: any = { modifiedOn: new Date() };
    if (dto.sourceLocationId) updates.sourceLocationId = dto.sourceLocationId;
    if (dto.destinationLocationId) updates.destinationLocationId = dto.destinationLocationId;
    if (dto.notes !== undefined) updates.notes = dto.notes;

    if (Object.keys(updates).length > 1) {
      await this.db
        .update(transferOrders)
        .set(updates)
        .where(eq(transferOrders.transferOrderId, id));
    }

    return { success: true };
  }

  async addLine(id: string, dto: CreateTransferOrderLineDto, actor: string) {
    const [existing] = await this.db
      .select({ stateCode: transferOrders.stateCode })
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, id));

    if (!existing) throw new NotFoundException('Transfer order not found');
    if (existing.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED) {
      throw new BadRequestException('Cannot edit an order that is already in progress');
    }

    const lineId = uuidv4();
    await this.db.insert(transferOrderLines).values({
      transferOrderLineId: lineId,
      transferOrderId: id,
      productId: dto.productId,
      quantity: dto.quantity,
    });

    return { lineId };
  }

  async updateLine(id: string, lineId: string, dto: UpdateTransferOrderLineDto, actor: string) {
    const [existing] = await this.db
      .select({ stateCode: transferOrders.stateCode })
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, id));

    if (!existing) throw new NotFoundException('Transfer order not found');
    if (existing.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED) {
      throw new BadRequestException('Cannot edit an order that is already in progress');
    }

    if (dto.quantity !== undefined) {
      await this.db
        .update(transferOrderLines)
        .set({ quantity: dto.quantity })
        .where(eq(transferOrderLines.transferOrderLineId, lineId));
    }
    return { success: true };
  }

  async removeLine(id: string, lineId: string, actor: string) {
    const [existing] = await this.db
      .select({ stateCode: transferOrders.stateCode })
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, id));

    if (!existing) throw new NotFoundException('Transfer order not found');
    if (existing.stateCode !== TRANSFER_ORDER_STATE.CONFIRMED) {
      throw new BadRequestException('Cannot edit an order that is already in progress');
    }

    await this.db
      .delete(transferOrderLines)
      .where(eq(transferOrderLines.transferOrderLineId, lineId));

    return { success: true };
  }
}
`;

content = content.replace(/}\s*$/, code);
fs.writeFileSync('apps/api/src/orders/transfers/transfers.service.ts', content);
console.log('Appended CRUD to transfers.service.ts');
