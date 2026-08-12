import { Injectable } from '@nestjs/common';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import type { WorkOrderState } from '@herobm/shared';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import {
  UpdateWorkOrderDto,
  UpdateWorkOrderComponentDto,
} from './dto/update-work-order.dto';

import {
  WorkOrdersQueryService,
  WorkOrderRow,
} from './work-orders-query.service';
import { WorkOrdersWriteService } from './work-orders-write.service';
import { WorkOrdersExecutionService } from './work-orders-execution.service';

export type { WorkOrderRow } from './work-orders-query.service';

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly queryService: WorkOrdersQueryService,
    private readonly writeService: WorkOrdersWriteService,
    private readonly executionService: WorkOrdersExecutionService,
  ) {}

  async changeWorkOrderState(
    id: string,
    newState: WorkOrderState,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.executionService.changeWorkOrderState(
      id,
      newState,
      username,
      tx,
    );
  }

  async findAll(days?: number, tx?: DrizzleDB): Promise<WorkOrderRow[]> {
    return this.queryService.findAll(days, tx);
  }

  async findOne(id: string, tx?: DrizzleDB) {
    return this.queryService.findOne(id, tx);
  }

  async create(dto: CreateWorkOrderDto, username?: string, tx?: DrizzleDB) {
    return this.writeService.create(dto, username, tx);
  }

  async update(
    id: string,
    dto: UpdateWorkOrderDto,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.writeService.update(id, dto, username, tx);
  }

  async updateComponent(
    workOrderId: string,
    componentId: string,
    dto: UpdateWorkOrderComponentDto,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.writeService.updateComponent(
      workOrderId,
      componentId,
      dto,
      username,
      tx,
    );
  }

  async release(id: string, username?: string, tx?: DrizzleDB) {
    return this.executionService.release(id, username, tx);
  }

  async completeBuild(
    id: string,
    outputBinId?: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.executionService.completeBuild(id, outputBinId, username, tx);
  }

  async cancel(id: string, username?: string, tx?: DrizzleDB) {
    return this.executionService.cancel(id, username, tx);
  }

  async getPickingSummary(id: string, tx?: DrizzleDB) {
    return this.queryService.getPickingSummary(id, tx);
  }

  async pickComponent(
    id: string,
    componentId: string,
    binId: string,
    quantity: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.writeService.pickComponent(
      id,
      componentId,
      binId,
      quantity,
      username,
      tx,
    );
  }

  async cancelComponentPick(
    id: string,
    pickId: string,
    username?: string,
    tx?: DrizzleDB,
  ) {
    return this.writeService.cancelComponentPick(id, pickId, username, tx);
  }
}
