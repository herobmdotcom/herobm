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
import { TaxCategoriesService } from './tax-categories.service';
import { CreateTaxCategoryDto, UpdateTaxCategoryDto } from './dto';

@Controller('tax-categories')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class TaxCategoriesController {
  constructor(private readonly taxService: TaxCategoriesService) {}

  @Get()
  @CasbinAction('read')
  findAll() {
    return this.taxService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.taxService.getById(id);
  }

  @Post()
  @CasbinAction('write')
  create(@Body() dto: CreateTaxCategoryDto) {
    return this.taxService.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() dto: UpdateTaxCategoryDto) {
    return this.taxService.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  remove(@Param('id') id: string) {
    return this.taxService.delete(id);
  }
}
