import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MacrosService } from './macros.service';
import { CreateMacroDto } from './dto/create-macro.dto';
import { UpdateMacroDto } from './dto/update-macro.dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@Controller('macros')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class MacrosController {
  constructor(private readonly macrosService: MacrosService) {}

  @Post()
  @CasbinAction('write')
  create(@Body() createMacroDto: CreateMacroDto) {
    return this.macrosService.create(createMacroDto);
  }

  @Get()
  @CasbinAction('read')
  findAll(@Query('macroType') macroType?: string) {
    return this.macrosService.findAll(macroType);
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.macrosService.findOne(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() updateMacroDto: UpdateMacroDto) {
    return this.macrosService.update(id, updateMacroDto);
  }

  @Delete(':id')
  @CasbinAction('write')
  remove(@Param('id') id: string) {
    return this.macrosService.remove(id);
  }
}
