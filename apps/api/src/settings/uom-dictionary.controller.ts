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
import { UomDictionaryService } from './uom-dictionary.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { CreateUomDto, UpdateUomDto } from './dto';

@Controller('settings/uom-dictionary')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class UomDictionaryController {
  constructor(private readonly uomService: UomDictionaryService) {}

  @Get()
  @CasbinAction('read')
  findAll() {
    return this.uomService.findAll();
  }

  @Get(':code')
  @CasbinAction('read')
  findOne(@Param('code') code: string) {
    return this.uomService.findOne(code);
  }

  @Post()
  @CasbinAction('write')
  create(@Body() dto: CreateUomDto) {
    return this.uomService.create(dto);
  }

  @Patch(':code')
  @CasbinAction('write')
  update(@Param('code') code: string, @Body() dto: UpdateUomDto) {
    return this.uomService.update(code, dto);
  }

  @Delete(':code')
  @CasbinAction('write')
  remove(@Param('code') code: string) {
    return this.uomService.delete(code);
  }
}
