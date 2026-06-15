import { SystemResource } from '@herobm/shared';
import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { DataSourcesRegistry } from './data-sources.registry';
import {
  DataSourceItemDto,
  SampleReportDto,
  SampleRecordDto,
} from './data-sources.dto';

@ApiTags('System')
@CasbinResource(SystemResource.BUSINESS_REPORT)
@Controller('data-sources')
export class DataSourcesController {
  constructor(private readonly registry: DataSourcesRegistry) {}

  @Get()
  @CasbinAction('read')
  @ApiOkResponse({
    description: 'List of data sources',
    type: [DataSourceItemDto],
  })
  @ApiOperation({
    summary: 'List all registered data sources',
    description:
      'Retrieves a list of all available data sources registered in the system.',
  })
  list() {
    return this.registry.getRegisteredProviders();
  }

  @Get(':slug/sample-report')
  @CasbinAction('read')
  @ApiOkResponse({
    description: 'Sample report data',
    type: SampleReportDto,
  })
  @ApiOperation({
    summary: 'Get sample data for Business Reports (fetchData format)',
    description: 'Retrieves sample data suitable for Business Reports preview.',
  })
  async getSampleReport(@Param('slug') slug: string) {
    const provider = this.registry.getProvider(slug);
    if (!provider) {
      throw new NotFoundException(`Data source ${slug} not found`);
    }

    // First try the fallback mock data generator if it exists
    if (provider.generateMockData) {
      return { isMockData: true, data: provider.generateMockData() };
    }

    // Attempt real data fetch
    if (provider.fetchData) {
      const data = await provider.fetchData({});
      if (data && data.length > 0) {
        return { isMockData: false, data };
      }
    }

    return {
      isMockData: true,
      data: [
        { _mock: 'No data available in DB and no mock generator provided' },
      ],
    };
  }

  @Get(':slug/sample-record')
  @CasbinAction('read')
  @ApiOkResponse({
    description: 'Sample record data',
    type: SampleRecordDto,
  })
  @ApiOperation({
    summary: 'Get sample data for PDF Templates (resolveData format)',
    description:
      'Retrieves a sample record suitable for PDF template preview and context generation.',
  })
  async getSampleRecord(@Param('slug') slug: string) {
    const provider = this.registry.getProvider(slug);
    if (!provider) {
      throw new NotFoundException(`Data source ${slug} not found`);
    }

    // Try mock first
    if (provider.generateMockData) {
      return { isMockData: true, data: provider.generateMockData() };
    }

    if (provider.getRandomId && provider.resolveData) {
      const id = await provider.getRandomId();
      if (id) {
        // We simulate a user or pass undefined, depending on implementation
        const data = await provider.resolveData(id, {});
        return { isMockData: false, data };
      }
    }

    return {
      isMockData: true,
      data: { _mock: 'No data available in DB and no mock generator provided' },
    };
  }
}
