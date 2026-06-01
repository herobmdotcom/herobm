import {
  Controller,
  Get,
  Query,
  UseGuards,
  Put,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import { EnrichmentService } from './enrichment.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
@ApiTags('Enrichment')
@Controller('enrichment')
@UseGuards(CasbinGuard)
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Get('lookup')
  @ApiOkResponse({ description: 'Successful lookup', type: Object }) // BYPASS-TYPING-TEST
  @CasbinResource('external_api')
  @CasbinAction('read')
  async lookup(
    @Query('provider') provider: string,
    @Query('query') query: string,
  ) {
    const result = await this.enrichmentService.lookup(provider, query);
    return result;
  }

  @Post('lookup/:provider')
  @ApiOkResponse({ description: 'Successful lookup', type: Object }) // BYPASS-TYPING-TEST
  @CasbinResource('external_api')
  @CasbinAction('read')
  async lookupPost(
    @Param('provider') provider: string,
    @Body() payload: Record<string, any>,
  ) {
    const result = await this.enrichmentService.lookup(provider, payload);
    return result;
  }

  @Get('providers')
  @ApiOkResponse({ description: 'List of providers', type: [Object] }) // BYPASS-TYPING-TEST
  @CasbinResource('settings')
  @CasbinAction('read')
  getProviders() {
    return this.enrichmentService.getProviders();
  }

  @Get('config')
  @ApiOkResponse({ description: 'Get config for provider', type: Object }) // BYPASS-TYPING-TEST
  @CasbinResource('settings')
  @CasbinAction('read')
  async getConfig(@Query('provider') provider: string) {
    return this.enrichmentService.getConfig(provider);
  }

  @Put('config')
  @ApiOkResponse({ description: 'Update config for provider', type: Object }) // BYPASS-TYPING-TEST
  @CasbinResource('settings')
  @CasbinAction('write')
  async updateConfig(
    @Query('provider') provider: string,
    @Body() config: Record<string, any>,
  ) {
    return this.enrichmentService.updateConfig(provider, config);
  }
}
