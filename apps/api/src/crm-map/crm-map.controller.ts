import { SystemResource } from '@herobm/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import { CrmMapService } from './crm-map.service';
import { CrmMapQueryDto, CrmMapResponseDto } from './dto';

@ApiTags('CRM Map')
@Controller('crm-map')
@CasbinResource(SystemResource.CRM)
export class CrmMapController {
  constructor(private readonly crmMapService: CrmMapService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get CRM Graph Map Data',
    description: 'Get CRM Graph Map Data',
  })
  @ApiOkResponse({ type: CrmMapResponseDto })
  async getMap(@Query() query: CrmMapQueryDto) {
    return this.crmMapService.getMapData(
      query.focalNodeId,
      query.maxDistance ? Number(query.maxDistance) : 2,
    );
  }
}
