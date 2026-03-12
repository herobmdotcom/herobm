import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GstCategoriesService } from './gst-categories.service';
import { CasbinGuard, CasbinResource, CasbinAction } from '../auth/casbin.guard';

@Controller('gst-categories')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('gst-categories')
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
}
