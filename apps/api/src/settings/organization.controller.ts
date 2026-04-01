import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationService } from './organization.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { UpdateOrganizationDto } from './dto';

@Controller('settings/organization')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  @CasbinAction('read')
  get() {
    return this.orgService.get();
  }

  @Patch()
  @CasbinAction('write')
  update(@Body() dto: UpdateOrganizationDto) {
    return this.orgService.update(dto);
  }
}
