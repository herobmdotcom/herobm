import {
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
  ApiTags,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
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
import { PaginationQuery, ApiPaginatedResponse } from '../common/pagination';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import {
  PutawayBulkDto,
  ToggleQuarantineDto,
  InventoryResponseDto,
  InventoryBinResponseDto,
  PutawayContextResponseDto,
  InventoryMovementResponseDto,
  InventoryLedgerResponseDto,
  InventoryEntryDetailsResponseDto,
  FindByProductIdsBulkDto,
  PendingPutawayResponseDto,
  InventoryLocationResponseDto,
  LocationsResponseDto,
} from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Inventory',
    description: 'Retrieve a paginated list of inventory levels.',
  })
  @ApiPaginatedResponse(InventoryResponseDto)
  @ApiFieldMask()
  findAll(
    @Query() query: PaginationQuery,
    @Query('locationNo') locationNo?: string,
  ) {
    return this.inventoryService.findAll({ ...query, locationNo });
  }

  @Get('by-products')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get By Products',
    description: 'Retrieve inventory items for specific product IDs.',
  })
  @ApiOkResponse({ type: InventoryResponseDto, isArray: true })
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
    const res = await this.inventoryService.findByProductIds(ids, locationId);
    return res.data;
  }

  @Post('by-products-bulk')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Bulk Get By Products',
    description: 'Retrieve inventory items for multiple product IDs in bulk.',
  })
  @ApiCreatedResponse({ type: InventoryResponseDto, isArray: true })
  async findByProductIdsBulk(@Body() dto: FindByProductIdsBulkDto) {
    const res = await this.inventoryService.findByProductIds(
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
  findBins(
    @Query() query: PaginationQuery,
    @Query('locationNo') locationNo?: string,
  ) {
    return this.inventoryService.findBins({ ...query, locationNo });
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
    return this.inventoryService.getPutawayContext(productId, locationId);
  }

  @Get('locations')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Locations',
    description: 'Retrieve all inventory locations.',
  })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiOkResponse({ type: LocationsResponseDto })
  findAllLocations(@Query('productId') productId?: string) {
    return this.inventoryService.findAllLocations(productId);
  }

  @Get('movements')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Movements',
    description: 'Retrieve inventory movements.',
  })
  @ApiOkResponse({ type: InventoryMovementResponseDto, isArray: true })
  getMovements(@Query('days') days?: string) {
    const daysInt = parseInt(days || '30', 10);
    return this.inventoryService.getMovements(isNaN(daysInt) ? 30 : daysInt);
  }

  @Get('ledger')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Ledger Entries',
    description: 'Retrieve inventory ledger entries.',
  })
  @ApiOkResponse({ type: InventoryLedgerResponseDto, isArray: true })
  getLedger(@Query('days') days?: string) {
    const daysInt = parseInt(days || '30', 10);
    return this.inventoryService.getLedger(isNaN(daysInt) ? 30 : daysInt);
  }

  @Get('entries/:id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Entry Details',
    description: 'Retrieve details for a specific inventory entry.',
  })
  @ApiOkResponse({ type: InventoryEntryDetailsResponseDto })
  getEntryDetails(@Param('id') id: string) {
    return this.inventoryService.getEntryDetails(id);
  }

  @Get('pending-putaway')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Pending Putaways',
    description: 'Retrieve pending putaway lines.',
  })
  @ApiOkResponse({ type: PendingPutawayResponseDto, isArray: true })
  async getPendingPutaway(@Query('locationId') locationId?: string) {
    return this.inventoryService.getPendingPutaway(locationId);
  }

  @Post('putaway')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Process Putaways',
    description: 'Process inventory putaway.',
  })
  @ApiCreatedResponse({ type: Object, description: 'Putaway successful' }) // BYPASS-TYPING-TEST
  async putaway(@Body() dto: PutawayBulkDto, @AuthUser() user: JwtUser) {
    return this.inventoryService.putaway(dto, user.username);
  }

  @Post('quarantine/:lineId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Toggle Quarantine',
    description: 'Toggle quarantine state for an inventory item.',
  })
  @ApiCreatedResponse({ type: Object, description: 'Quarantine state toggled' }) // BYPASS-TYPING-TEST
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
