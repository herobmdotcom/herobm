import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TradingTermsService } from './trading-terms.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@Controller('settings/trading-terms')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class TradingTermsController {
  constructor(private readonly termsService: TradingTermsService) {}

  @Get()
  @CasbinAction('read')
  findAll() {
    return this.termsService.findAll();
  }
}
