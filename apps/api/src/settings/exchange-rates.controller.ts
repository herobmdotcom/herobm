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
import { CreateExchangeRateDto, UpdateExchangeRateDto } from './dto';

@Controller('settings/exchange-rates')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class ExchangeRatesController {
  constructor(private readonly exchangeService: ExchangeRatesService) {}

  @Get()
  @CasbinAction('read')
  findAll() {
    return this.exchangeService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.exchangeService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  create(@Body() dto: CreateExchangeRateDto) {
    return this.exchangeService.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() dto: UpdateExchangeRateDto) {
    return this.exchangeService.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  remove(@Param('id') id: string) {
    return this.exchangeService.delete(id);
  }
}
