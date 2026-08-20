// security-ignore: dto-validation
import { SystemResource } from '@herobm/shared';
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Put,
  Post,
  Body,
} from '@nestjs/common';
import { EnrichmentService } from './enrichment.service';
import {
  EnrichmentPayloadDto,
  EnrichmentResultDto,
  EnrichmentProviderDto,
} from './enrichment.dto';
import { CasbinResource, CasbinAction, SkipCasbin } from '../auth/casbin.guard';
import { ApiOkResponse, ApiTags, ApiBody, ApiOperation } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('System')
@Controller('enrichment')
@UseGuards(ThrottlerGuard)
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @SkipCasbin()
  @Get('lookup')
  @ApiOperation({ summary: 'Lookup data', description: 'Lookup data by field' })
  @ApiOkResponse({
    description: 'Successful lookup',
    type: EnrichmentResultDto,
  })
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
  @ApiOkResponse({
    description: 'Successful lookup',
    type: EnrichmentResultDto,
  })
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
  @ApiOkResponse({
    description: 'Test provider lookup',
    type: EnrichmentResultDto,
  })
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
  @ApiOkResponse({
    description: 'Test provider lookup',
    type: EnrichmentResultDto,
  })
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
  @ApiOkResponse({
    description: 'List of providers',
    type: [EnrichmentProviderDto],
  })
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
  @ApiOkResponse({
    description: 'Get config for provider',
    schema: { type: 'object', additionalProperties: true },
  })
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
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  @ApiOkResponse({
    description: 'Update config for provider',
    schema: { type: 'object', additionalProperties: true },
  })
  async updateConfig(
    @Query('provider') provider: string,
    @Body() config: Record<string, unknown>,
  ) {
    return this.enrichmentService.updateConfig(provider, config);
  }
}
