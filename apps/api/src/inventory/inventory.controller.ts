import { SystemResource } from '@herobm/shared';
import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { InventoryQueryService } from './inventory-query.service';
import { InventoryMovementService } from './inventory-movement.service';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { PaginationQuery, ApiPaginatedResponse } from '../common/pagination';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import {
  PutawayBulkDto,
  QuarantineMoveDto,
  MoveStockDto,
  AdjustStockDto,
  InventoryResponseDto,
  InventoryBinResponseDto,
  PutawayContextResponseDto,
  InventoryLedgerResponseDto,
  InventoryEntryDetailsResponseDto,
  FindByProductIdsBulkDto,
  InventoryLocationResponseDto,
  TopographyLocationResponseDto,
  PendingPutawayResponseDto,
  InventorySuccessResponseDto,
} from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Warehouse')
@Controller('inventory')
@CasbinResource(SystemResource.INVENTORY)
export class InventoryController {
  constructor(
    private readonly inventoryQueryService: InventoryQueryService,
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Inventory',
    description: 'Retrieve a paginated list of inventory levels.',
  })
  @ApiPaginatedResponse(InventoryResponseDto)
  @ApiFieldMask()
  @ApiQuery({ name: 'locationNo', required: false })
  findAll(
    @Query() query: PaginationQuery,
    @Query('locationNo') locationNo?: string,
  ) {
    return this.inventoryQueryService.findAll({ ...query, locationNo });
  }

  @Get('by-products')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get By Products',
    description: 'Retrieve inventory items for specific product IDs.',
  })
  @ApiOkResponse({ type: [InventoryResponseDto] })
  @ApiQuery({ name: 'productIds', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  async findByProductIds(
    @Query('productIds') productIds?: string,
    @Query('locationId') locationId?: string,
  ) {
    const ids = productIds
      ? productIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
    const res = await this.inventoryQueryService.findByProductIds(
      ids,
      locationId,
    );
    return res.data;
  }

  @Post('by-products-bulk')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Bulk Get By Products',
    description: 'Retrieve inventory items for multiple product IDs in bulk.',
  })
  @ApiCreatedResponse({ type: [InventoryResponseDto] })
  async findByProductIdsBulk(@Body() dto: FindByProductIdsBulkDto) {
    const res = await this.inventoryQueryService.findByProductIds(
      dto.productIds || [],
      dto.locationId,
    );
    return res.data;
  }

  @Get('bins')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Inventory Bins',
    description: 'Retrieve a paginated list of inventory bins.',
  })
  @ApiPaginatedResponse(InventoryBinResponseDto)
  @ApiQuery({ name: 'locationNo', required: false })
  @ApiQuery({ name: 'binType', required: false })
  findBins(
    @Query() query: PaginationQuery,
    @Query('locationNo') locationNo?: string,
    @Query('binType') binType?: string,
  ) {
    return this.inventoryQueryService.findBins({
      ...query,
      locationNo,
      binType,
    });
  }

  @Get('putaway-context')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Putaway Context',
    description: 'Retrieve context for putting away inventory.',
  })
  @ApiOkResponse({ type: PutawayContextResponseDto })
  async getPutawayContext(
    @Query('productId') productId: string,
    @Query('locationId') locationId: string,
  ) {
    if (!productId || !locationId) {
      throw new NotFoundException('productId and locationId are required');
    }
    return this.inventoryQueryService.getPutawayContext(productId, locationId);
  }

  @Get('locations')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Locations',
    description: 'Retrieve all inventory locations.',
  })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiOkResponse({ type: [InventoryLocationResponseDto] })
  async findAllLocations(@Query('productId') productId?: string) {
    return this.inventoryQueryService.findAllLocations(productId);
  }

  @Get('locations/:id/bins')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Location Bins',
    description: 'Retrieve all bins for a specific location.',
  })
  @ApiQuery({ name: 'binType', required: false, type: String })
  @ApiQuery({ name: 'zoneCode', required: false, type: String })
  @ApiOkResponse({ type: [InventoryBinResponseDto] })
  async findBinsByLocation(
    @Param('id') id: string,
    @Query('binType') binType?: string,
    @Query('zoneCode') zoneCode?: string,
  ) {
    return this.inventoryQueryService.findBinsByLocation(id, binType, zoneCode);
  }

  @Get('topography')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Warehouse Topography',
    description: 'Retrieve full warehouse topography hierarchy.',
  })
  @ApiOkResponse({ type: [TopographyLocationResponseDto] })
  async getTopography() {
    return this.inventoryQueryService.getTopography();
  }

  @Get('ledger')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Ledger Entries',
    description: 'Retrieve inventory ledger entries.',
  })
  @ApiOkResponse({ type: [InventoryLedgerResponseDto] })
  @ApiQuery({ name: 'days', required: false })
  getLedger(@Query('days') days?: string) {
    const daysInt = parseInt(days || '30', 10);
    return this.inventoryQueryService.getLedger(isNaN(daysInt) ? 30 : daysInt);
  }

  @Get('entries/:id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Entry Details',
    description: 'Retrieve details for a specific inventory entry.',
  })
  @ApiOkResponse({ type: InventoryEntryDetailsResponseDto })
  getEntryDetails(@Param('id') id: string) {
    return this.inventoryQueryService.getEntryDetails(id);
  }

  @Get('pending-putaway')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Pending Putaways',
    description: 'Retrieve pending putaway lines.',
  })
  @ApiOkResponse({ type: [PendingPutawayResponseDto] })
  @ApiQuery({ name: 'locationId', required: false })
  async getPendingPutaway(@Query('locationId') locationId?: string) {
    return this.inventoryQueryService.getPendingPutaway(locationId);
  }

  @Post('putaway')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Process Putaways',
    description: 'Process inventory putaway.',
  })
  @ApiCreatedResponse({
    type: InventorySuccessResponseDto,
    description: 'Putaway successful',
  })
  async putaway(@Body() dto: PutawayBulkDto, @AuthUser() user: JwtUser) {
    return this.inventoryMovementService.putaway(dto, user.username);
  }

  @Post('quarantine/move')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Move to/from Quarantine',
    description: 'Move stock between quarantine and regular storage.',
  })
  @ApiCreatedResponse({
    type: InventorySuccessResponseDto,
    description: 'Quarantine move successful',
  })
  async quarantineMove(
    @Body() dto: QuarantineMoveDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.inventoryMovementService.quarantineStock(dto, user.username);
  }

  @Post('move')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Move Stock manually',
    description: 'Manually move stock between bins in the same location.',
  })
  @ApiCreatedResponse({
    type: InventorySuccessResponseDto,
    description: 'Move successful',
  })
  async moveStock(@Body() dto: MoveStockDto, @AuthUser() user: JwtUser) {
    return this.inventoryMovementService.moveStock(dto, user.username);
  }

  @Post('adjust')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Adjust Stock manually',
    description: 'Manually adjust stock levels to match a physical count.',
  })
  @ApiCreatedResponse({
    type: InventorySuccessResponseDto,
    description: 'Adjustment successful',
  })
  async adjustStock(@Body() dto: AdjustStockDto, @AuthUser() user: JwtUser) {
    return this.inventoryMovementService.adjustStock(dto, user.username);
  }
}
