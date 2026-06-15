import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationService } from './organization.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { UpdateOrganizationDto, OrganizationResponseDto } from './dto';

@Controller('settings/organization')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SETTINGS)
@ApiTags('System')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  @ApiOkResponse({ type: OrganizationResponseDto })
  @CasbinAction('read')
  @ApiOperation({ summary: 'get', description: 'get operation' })
  get() {
    return this.orgService.get();
  }

  @Patch()
  @ApiBody({ type: UpdateOrganizationDto })
  @ApiOkResponse({ type: OrganizationResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'update', description: 'update operation' })
  update(@Body() dto: UpdateOrganizationDto, @AuthUser() user: JwtUser) {
    return this.orgService.update(dto, user?.userId || 'system');
  }
}
