import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PurchaseOrdersService, PurchaseOrderSearchParams } from './purchase-orders.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@UseGuards(AuthGuard('jwt'), CasbinGuard)
@Controller('purchase-orders')
@CasbinResource('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) { }

  @Post()
  @CasbinAction('write')
  async create(@Body() createPurchaseOrderDto: any, @Req() req: any) {
    const user = req.user;
    return this.purchaseOrdersService.create(createPurchaseOrderDto, user.sub);
  }

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: PurchaseOrderSearchParams) {
    return this.purchaseOrdersService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string, @Query('source') source?: string) {
    if (source === 'abm') {
      return this.purchaseOrdersService.findAbmPurchaseOrder(id);
    }
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  async update(
    @Param('id') id: string,
    @Body() updatePurchaseOrderDto: any,
    @Req() req: any,
  ) {
    const user = req.user;
    return this.purchaseOrdersService.update(id, updatePurchaseOrderDto, user.sub);
  }

  @Patch(':id/state')
  @CasbinAction('write')
  async changeState(
    @Param('id') id: string,
    @Body('stateCode') stateCode: string,
  ) {
    return this.purchaseOrdersService.changeState(id, stateCode);
  }

  @Post(':id/lines')
  @CasbinAction('write')
  async addLine(@Param('id') id: string, @Body() body: any) {
    return this.purchaseOrdersService.addLine(id, body);
  }

  @Patch(':id/lines/:lineId')
  @CasbinAction('write')
  async updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: any,
  ) {
    return this.purchaseOrdersService.updateLine(id, lineId, body);
  }

  @Delete(':id/lines/:lineId')
  @CasbinAction('write')
  async removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.purchaseOrdersService.removeLine(id, lineId);
  }
}
