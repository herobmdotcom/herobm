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
import { ProductGroupsService } from './product-groups.service';
import type {
  CreateProductGroupDto,
  UpdateProductGroupDto,
} from './product-groups.service';

@Controller('product-groups')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class ProductGroupsController {
  constructor(private readonly productGroupsService: ProductGroupsService) {}

  @Get()
  @CasbinAction('read')
  findAll() {
    return this.productGroupsService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.productGroupsService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  create(@Body() dto: CreateProductGroupDto) {
    return this.productGroupsService.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() dto: UpdateProductGroupDto) {
    return this.productGroupsService.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  remove(@Param('id') id: string) {
    return this.productGroupsService.delete(id);
  }
}
