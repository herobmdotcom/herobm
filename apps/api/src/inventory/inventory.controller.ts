import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InventoryService } from './inventory.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { PaginationQuery } from '../common/pagination';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { PutawayBulkDto, ToggleQuarantineDto } from './dto';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @CasbinAction('read')
  findAll(
    @Query() query: PaginationQuery,
    @Query('locationNo') locationNo?: string,
  ) {
    return this.inventoryService.findAll({ ...query, locationNo });
  }

  @Get('by-products')
  @CasbinAction('read')
  findByProductIds(
    @Query('productIds') productIds?: string,
    @Query('locationId') locationId?: string,
  ) {
    const ids = productIds
      ? productIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
    return this.inventoryService.findByProductIds(ids, locationId);
  }

  @Post('by-products-bulk')
  @CasbinAction('read')
  findByProductIdsBulk(
    @Body() dto: { productIds: string[]; locationId?: string },
  ) {
    return this.inventoryService.findByProductIds(
      dto.productIds || [],
      dto.locationId,
    );
  }

  @Get('bins')
  @CasbinAction('read')
  findBins(
    @Query() query: PaginationQuery,
    @Query('locationNo') locationNo?: string,
  ) {
    return this.inventoryService.findBins({ ...query, locationNo });
  }

  @Get('putaway-context')
  @CasbinAction('read')
  async getPutawayContext(
    @Query('productId') productId: string,
    @Query('locationId') locationId: string,
  ) {
    if (!productId || !locationId) {
      throw new NotFoundException('productId and locationId are required');
    }
    return this.inventoryService.getPutawayContext(productId, locationId);
  }

  @Get('locations')
  @CasbinAction('read')
  findAllLocations(@Query('productId') productId?: string) {
    return this.inventoryService.findAllLocations(productId);
  }

  @Get('movements')
  @CasbinAction('read')
  getMovements(@Query('days') days?: string) {
    const daysInt = parseInt(days || '30', 10);
    return this.inventoryService.getMovements(isNaN(daysInt) ? 30 : daysInt);
  }

  @Get('ledger')
  @CasbinAction('read')
  getLedger(@Query('days') days?: string) {
    const daysInt = parseInt(days || '30', 10);
    return this.inventoryService.getLedger(isNaN(daysInt) ? 30 : daysInt);
  }

  @Get('entries/:id')
  @CasbinAction('read')
  getEntryDetails(@Param('id') id: string) {
    return this.inventoryService.getEntryDetails(id);
  }

  @Get('pending-putaway')
  @CasbinAction('read')
  async getPendingPutaway(@Query('locationId') locationId?: string) {
    return this.inventoryService.getPendingPutaway(locationId);
  }

  @Post('putaway')
  @CasbinAction('write')
  async putaway(@Body() dto: PutawayBulkDto, @AuthUser() user: JwtUser) {
    return this.inventoryService.putaway(dto, user.username);
  }

  @Post('quarantine/:lineId')
  @CasbinAction('write')
  async toggleQuarantine(
    @Param('lineId') lineId: string,
    @Body() dto: ToggleQuarantineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.inventoryService.toggleQuarantine(
      lineId,
      dto.sourceType,
      user.username,
      dto.reason,
    );
  }
}
