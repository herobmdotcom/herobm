import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
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
import { MacroResponseDto } from './dto/macro-response.dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('Macros')
@Controller('macros')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('settings')
export class MacrosController {
  constructor(private readonly macrosService: MacrosService) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Macro',
    description: 'Registers a new automated macro rule.',
  })
  @ApiCreatedResponse({ type: MacroResponseDto })
  create(@Body() createMacroDto: CreateMacroDto) {
    return this.macrosService.create(createMacroDto);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Macros',
    description: 'Retrieves all configured automation macros.',
  })
  @ApiOkResponse({ type: [MacroResponseDto] })
  @ApiFieldMask()
  @ApiQuery({ name: 'macroType', required: false })
  findAll(@Query('macroType') macroType?: string) {
    return this.macrosService.findAll(macroType);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Macro',
    description: 'Retrieves a single macro configuration by ID.',
  })
  @ApiOkResponse({ type: MacroResponseDto })
  @ApiFieldMask()
  findOne(@Param('id') id: string) {
    return this.macrosService.findOne(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Macro',
    description: 'Modifies an existing macro definition.',
  })
  @ApiOkResponse({ type: MacroResponseDto })
  update(@Param('id') id: string, @Body() updateMacroDto: UpdateMacroDto) {
    return this.macrosService.update(id, updateMacroDto);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Macro',
    description: 'Permanently removes a macro configuration.',
  })
  @ApiOkResponse({ type: MacroResponseDto })
  remove(@Param('id') id: string) {
    return this.macrosService.remove(id);
  }
}
