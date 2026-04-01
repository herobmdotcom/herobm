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
import { GstCategoriesService } from './gst-categories.service';
import { CreateGstCategoryDto, UpdateGstCategoryDto } from './dto';

@Controller('gst-categories')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class GstCategoriesController {
  constructor(private readonly gstService: GstCategoriesService) {}

  @Get()
  @CasbinAction('read')
  findAll() {
    return this.gstService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.gstService.getById(id);
  }

  @Post()
  @CasbinAction('write')
  create(@Body() dto: CreateGstCategoryDto) {
    return this.gstService.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() dto: UpdateGstCategoryDto) {
    return this.gstService.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  remove(@Param('id') id: string) {
    return this.gstService.delete(id);
  }
}
