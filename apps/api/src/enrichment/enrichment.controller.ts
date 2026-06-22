import { SystemResource } from '@herobm/shared';
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
import { EnrichmentPayloadDto } from './enrichment.dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
  SkipCasbin,
} from '../auth/casbin.guard';
import { ApiOkResponse, ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('System')
@Controller('enrichment')
@UseGuards(CasbinGuard, ThrottlerGuard)
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @SkipCasbin()
  @Get('lookup')
  @ApiOperation({ summary: 'Lookup data', description: 'Lookup data by field' })
  @ApiOkResponse({ description: 'Successful lookup', type: Object }) // BYPASS-TYPING-TEST
  async lookup(
    @Query('field') field: string,
    @Query('country') country: string,
    @Query('query') query: string,
  ) {
    const result = await this.enrichmentService.lookupByField(
      field,
      country,
      query,
    );
    return result;
  }

  @SkipCasbin()
  @Post('lookup')
  @ApiOperation({
    summary: 'Lookup data (POST)',
    description: 'Lookup data by field using POST',
  })
  @ApiOkResponse({ description: 'Successful lookup', type: Object }) // BYPASS-TYPING-TEST
  async lookupPost(
    @Query('field') field: string,
    @Query('country') country: string,
    @Body() dto: EnrichmentPayloadDto,
  ) {
    const result = await this.enrichmentService.lookupByField(
      field,
      country,
      dto.payload || {},
    );
    return result;
  }

  @SkipCasbin()
  @Get('test')
  @ApiOperation({
    summary: 'Test provider',
    description: 'Test provider lookup',
  })
  @ApiOkResponse({ description: 'Test provider lookup', type: Object }) // BYPASS-TYPING-TEST
  async testLookup(
    @Query('provider') provider: string,
    @Query('query') query: string,
  ) {
    const result = await this.enrichmentService.lookup(provider, query);
    return result;
  }

  @SkipCasbin()
  @Post('test')
  @ApiOperation({
    summary: 'Test provider (POST)',
    description: 'Test provider lookup using POST',
  })
  @ApiOkResponse({ description: 'Test provider lookup', type: Object }) // BYPASS-TYPING-TEST
  async testLookupPost(
    @Query('provider') provider: string,
    @Body() dto: EnrichmentPayloadDto,
  ) {
    const result = await this.enrichmentService.lookup(
      provider,
      dto.payload || {},
    );
    return result;
  }

  @CasbinResource(SystemResource.SETTINGS)
  @CasbinAction('read')
  @Get('providers')
  @ApiOperation({
    summary: 'Get providers',
    description: 'List of available enrichment providers',
  })
  @ApiOkResponse({ description: 'List of providers', type: [Object] }) // BYPASS-TYPING-TEST
  getProviders() {
    return this.enrichmentService.getProviders();
  }

  @CasbinResource(SystemResource.SETTINGS)
  @CasbinAction('read')
  @Get('config')
  @ApiOperation({
    summary: 'Get config',
    description: 'Get config for provider',
  })
  @ApiOkResponse({ description: 'Get config for provider', type: Object }) // BYPASS-TYPING-TEST
  async getConfig(@Query('provider') provider: string) {
    return this.enrichmentService.getConfig(provider);
  }

  @CasbinResource(SystemResource.SETTINGS)
  @CasbinAction('write')
  @Put('config')
  @ApiOperation({
    summary: 'Update config',
    description: 'Update config for provider',
  })
  @ApiOkResponse({ description: 'Update config for provider', type: Object }) // BYPASS-TYPING-TEST
  @ApiBody({ type: Object }) // BYPASS-TYPING-TEST
  async updateConfig(
    @Query('provider') provider: string,
    // The config body is an untyped JSON payload whose structure depends on the specific enrichment provider.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    @Body() config: Record<string, any>,
  ) {
    return this.enrichmentService.updateConfig(provider, config);
  }
}
