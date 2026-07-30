import { SystemResource } from '@herobm/shared';
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
} from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import {
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import {
  CreateExchangeRateDto,
  UpdateExchangeRateDto,
  ExchangeRateResponseDto,
} from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@Controller('settings/exchange-rates')
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
  create(@Body() dto: CreateExchangeRateDto, @AuthUser() user: JwtUser) {
    return this.exchangeService.create(dto, user?.userId);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateExchangeRateDto })
  @ApiOkResponse({ type: ExchangeRateResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'update', description: 'update operation' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExchangeRateDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.exchangeService.update(id, dto, user?.userId);
  }

  @Delete(':id')
  @ApiOkResponse({ type: ExchangeRateResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'remove', description: 'remove operation' })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.exchangeService.delete(id, user?.userId);
  }
}
