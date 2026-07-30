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
  Body,
  Param,
} from '@nestjs/common';
import { TradingTermsService } from './trading-terms.service';
import {
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  TradingTermResponseDto,
  CreateTradingTermDto,
  UpdateTradingTermDto,
  SettingsSuccessResponseDto,
} from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@Controller('settings/trading-terms')
@CasbinResource(SystemResource.SETTINGS)
@ApiTags('System')
export class TradingTermsController {
  constructor(private readonly termsService: TradingTermsService) {}

  @Get()
  @ApiOkResponse({ type: [TradingTermResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List trading terms',
    description: 'List all trading terms',
  })
  @ApiFieldMask()
  findAll() {
    return this.termsService.findAll();
  }

  @Post()
  @ApiCreatedResponse({ type: TradingTermResponseDto })
  @ApiBody({ type: CreateTradingTermDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create trading term',
    description: 'Create a new trading term',
  })
  create(@Body() dto: CreateTradingTermDto) {
    return this.termsService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: TradingTermResponseDto })
  @ApiBody({ type: UpdateTradingTermDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update trading term',
    description: 'Update an existing trading term',
  })
  update(@Param('id') id: string, @Body() dto: UpdateTradingTermDto) {
    return this.termsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: SettingsSuccessResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete trading term',
    description: 'Delete an existing trading term',
  })
  delete(@Param('id') id: string) {
    return this.termsService.delete(id);
  }
}
