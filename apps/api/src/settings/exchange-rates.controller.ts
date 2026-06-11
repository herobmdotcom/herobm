import { SystemResource } from '@modbm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExchangeRatesService } from './exchange-rates.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreateExchangeRateDto,
  UpdateExchangeRateDto,
  ExchangeRateResponseDto,
} from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@Controller('settings/exchange-rates')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SETTINGS)
@ApiTags('General Ledger')
export class ExchangeRatesController {
  constructor(private readonly exchangeService: ExchangeRatesService) {}

  @Get()
  @ApiOkResponse({ type: [ExchangeRateResponseDto] })
  @CasbinAction('read')
  @ApiOperation({ summary: 'findAll', description: 'findAll operation' })
  @ApiFieldMask()
  findAll() {
    return this.exchangeService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: ExchangeRateResponseDto })
  @CasbinAction('read')
  @ApiOperation({ summary: 'findOne', description: 'findOne operation' })
  @ApiFieldMask()
  findOne(@Param('id') id: string) {
    return this.exchangeService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateExchangeRateDto })
  @ApiCreatedResponse({ type: ExchangeRateResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'create', description: 'create operation' })
  create(@Body() dto: CreateExchangeRateDto) {
    return this.exchangeService.create(dto);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateExchangeRateDto })
  @ApiOkResponse({ type: ExchangeRateResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'update', description: 'update operation' })
  update(@Param('id') id: string, @Body() dto: UpdateExchangeRateDto) {
    return this.exchangeService.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: ExchangeRateResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'remove', description: 'remove operation' })
  remove(@Param('id') id: string) {
    return this.exchangeService.delete(id);
  }
}
