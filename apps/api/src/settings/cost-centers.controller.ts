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
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto, UpdateCostCenterDto } from './dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('Settings')
@Controller('settings/cost-centers')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class CostCentersController {
  constructor(private readonly service: CostCentersService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({ summary: 'List all cost centers' })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({ summary: 'Create a new cost center' })
  create(@Body() dto: CreateCostCenterDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Update a cost center' })
  update(@Param('id') id: string, @Body() dto: UpdateCostCenterDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Delete a cost center' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
