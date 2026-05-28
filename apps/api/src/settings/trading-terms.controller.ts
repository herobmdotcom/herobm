import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TradingTermsService } from './trading-terms.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { TradingTermResponseDto } from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@Controller('settings/trading-terms')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('settings')
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
}
