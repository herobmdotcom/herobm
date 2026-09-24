import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SystemResource, type StocktakeState } from '@herobm/shared';
import { CasbinResource, CasbinAction } from '../../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../../auth/auth-user.decorator';
import { PaginationQuery, ApiPaginatedResponse } from '../../common/pagination';
import { StocktakesQueryService } from './stocktakes-query.service';
import { StocktakesWriteService } from './stocktakes-write.service';
import {
  CreateStocktakeDto,
  UpdateStocktakeDto,
  RecordStocktakeCountDto,
  BatchRecordStocktakeCountsDto,
  AddStocktakeUnlistedProductDto,
  UpdateStocktakeLineDto,
  StocktakeStateTransitionDto,
  SubmitStocktakeDto,
  StocktakeResponseDto,
  StocktakeLineResponseDto,
  StocktakeCountResponseDto,
  StocktakeSuccessResponseDto,
  MarkStocktakeBinEmptyDto,
} from './dto';

@ApiTags('Stocktakes')
@Controller('inventory/stocktakes')
@CasbinResource(SystemResource.INVENTORY)
export class StocktakesController {
  constructor(
    private readonly stocktakesQueryService: StocktakesQueryService,
    private readonly stocktakesWriteService: StocktakesWriteService,
  ) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Stocktake',
    description:
      'Create a new stocktake header with initial scope snapshot lines in draft state.',
  })
  @ApiCreatedResponse({ type: StocktakeResponseDto })
  create(@Body() dto: CreateStocktakeDto, @AuthUser() user: JwtUser) {
    return this.stocktakesWriteService.create(dto, user.username);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Stocktakes',
    description:
      'Retrieve a paginated list of stocktakes with aggregate progress metrics.',
  })
  @ApiPaginatedResponse(StocktakeResponseDto)
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'stateCode', required: false })
  findAll(
    @Query() query: PaginationQuery,
    @Query('locationId') locationId?: string,
    @Query('stateCode') stateCode?: StocktakeState,
  ) {
    return this.stocktakesQueryService.findAll({
      ...query,
      locationId,
      stateCode,
    });
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Stocktake by ID',
    description: 'Retrieve single stocktake by ID with progress stats.',
  })
  @ApiOkResponse({ type: StocktakeResponseDto })
  findOne(@Param('id') id: string) {
    return this.stocktakesQueryService.findOne(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Stocktake Header',
    description: 'Update stocktake name, notes, or blind count flag.',
  })
  @ApiOkResponse({ type: StocktakeResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStocktakeDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.stocktakesWriteService.update(id, dto, user.username);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Stocktake',
    description: 'Delete a draft or cancelled stocktake.',
  })
  @ApiOkResponse({ type: StocktakeSuccessResponseDto })
  delete(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.stocktakesWriteService.delete(id, user.username);
  }

  @Post(':id/state')
  @HttpCode(HttpStatus.OK)
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Change Stocktake State',
    description:
      'Transition lifecycle state (draft -> open -> review -> submitted / cancelled).',
  })
  @ApiOkResponse({ type: StocktakeResponseDto })
  changeState(
    @Param('id') id: string,
    @Body() dto: StocktakeStateTransitionDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.stocktakesWriteService.changeState(id, dto, user.username);
  }

  @Get(':id/lines')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Stocktake Lines',
    description:
      'Retrieve paginated lines for a stocktake. Expected quantities are masked during blind count in open state.',
  })
  @ApiPaginatedResponse(StocktakeLineResponseDto)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'uncounted',
      'counted',
      'discrepancies',
      'match',
      'surplus',
      'shortage',
    ],
  })
  @ApiQuery({ name: 'isUnlisted', required: false, type: Boolean })
  @ApiQuery({ name: 'binId', required: false, type: String })
  findLines(
    @Param('id') id: string,
    @Query() query: PaginationQuery,
    @Query('status') status?: string,
    @Query('isUnlisted') isUnlisted?: boolean,
    @Query('binId') binId?: string,
  ) {
    return this.stocktakesQueryService.findLines(id, {
      ...query,
      status,
      isUnlisted:
        isUnlisted !== undefined ? String(isUnlisted) === 'true' : undefined,
      binId,
    });
  }

  @Post(':id/lines')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Unlisted Product to Stocktake',
    description:
      'Add a product/bin not in the original scope during counting or review.',
  })
  @ApiCreatedResponse({ type: StocktakeLineResponseDto })
  addUnlistedProduct(
    @Param('id') id: string,
    @Body() dto: AddStocktakeUnlistedProductDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.stocktakesWriteService.addUnlistedProduct(
      id,
      dto,
      user.username,
    );
  }

  @Patch(':id/lines/:lineId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Stocktake Line',
    description:
      'Manually adjust line counted quantity or notes during review.',
  })
  @ApiOkResponse({ type: StocktakeLineResponseDto })
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateStocktakeLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.stocktakesWriteService.updateLine(
      id,
      lineId,
      dto,
      user.username,
    );
  }

  @Delete(':id/lines/:lineId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Stocktake Line',
    description:
      'Delete an unlisted or uncounted line from a draft/review stocktake.',
  })
  @ApiOkResponse({ type: StocktakeSuccessResponseDto })
  deleteLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.stocktakesWriteService.deleteLine(id, lineId, user.username);
  }

  @Get(':id/counts')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Stocktake Counts',
    description:
      'Retrieve the append-only scan/count log for audit and concurrency verification.',
  })
  @ApiPaginatedResponse(StocktakeCountResponseDto)
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'binId', required: false })
  findCounts(
    @Param('id') id: string,
    @Query() query: PaginationQuery,
    @Query('productId') productId?: string,
    @Query('binId') binId?: string,
  ) {
    return this.stocktakesQueryService.findCounts(id, {
      ...query,
      productId,
      binId,
    });
  }

  @Post(':id/counts')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Record Single Stocktake Count',
    description: 'Record a physical count/scan action by counter username.',
  })
  @ApiCreatedResponse({ type: StocktakeLineResponseDto })
  recordCount(
    @Param('id') id: string,
    @Body() dto: RecordStocktakeCountDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.stocktakesWriteService.recordCount(id, dto, user.username);
  }

  @Post(':id/counts/batch')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Record Batch Stocktake Counts',
    description: 'Record multiple physical counts/scans atomically.',
  })
  @ApiCreatedResponse({ type: [StocktakeLineResponseDto] })
  recordBatchCounts(
    @Param('id') id: string,
    @Body() dto: BatchRecordStocktakeCountsDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.stocktakesWriteService.recordBatchCounts(
      id,
      dto,
      user.username,
    );
  }

  @Post(':id/bins/:binId/mark-empty')
  @HttpCode(HttpStatus.OK)
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Mark Bin Empty',
    description:
      'Mark all uncounted items in the specified bin as zero quantity.',
  })
  @ApiOkResponse({ type: StocktakeSuccessResponseDto })
  markBinEmpty(
    @Param('id') id: string,
    @Param('binId') binId: string,
    @Body() dto: MarkStocktakeBinEmptyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.stocktakesWriteService.markBinEmpty(
      id,
      binId,
      user.username,
      dto?.notes,
    );
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Submit Stocktake Reconciliation',
    description:
      'Calculate live inventory deltas, write inventory adjustment movements, post GL shrinkage journals, and close stocktake.',
  })
  @ApiOkResponse({ type: StocktakeSuccessResponseDto })
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitStocktakeDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.stocktakesWriteService.submitReconciliation(
      id,
      dto,
      user.username,
    );
  }
}
