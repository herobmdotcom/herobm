import {
  Controller,
  Get,
  Param,
  UseGuards,
  Post,
  Patch,
  Body,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { SupplierGroupsService } from './supplier-groups.service';
import { CreateSupplierGroupDto, UpdateSupplierGroupDto } from './dto';

@Controller('supplier-groups')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class SupplierGroupsController {
  constructor(private readonly supplierGroupsService: SupplierGroupsService) {}

  @Get()
  @CasbinAction('read')
  findAll() {
    return this.supplierGroupsService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.supplierGroupsService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  create(@Body() dto: CreateSupplierGroupDto) {
    return this.supplierGroupsService.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierGroupDto) {
    return this.supplierGroupsService.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  remove(@Param('id') id: string) {
    return this.supplierGroupsService.delete(id);
  }
}
