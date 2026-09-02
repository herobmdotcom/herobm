import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { UomDictionaryService } from './uom-dictionary.service';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { CreateUomDto, UpdateUomDto, UomResponseDto } from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@Controller('settings/uom-dictionary')
@CasbinResource(SystemResource.SETTINGS)
@ApiTags('System')
export class UomDictionaryController {
  constructor(private readonly uomService: UomDictionaryService) {}

  @Get()
  @ApiOkResponse({ type: [UomResponseDto] })
  @CasbinAction('read')
  @ApiOperation({ summary: 'findAll', description: 'findAll operation' })
  @ApiFieldMask()
  findAll() {
    return this.uomService.findAll();
  }

  @Get(':code')
  @ApiOkResponse({ type: UomResponseDto })
  @CasbinAction('read')
  @ApiOperation({ summary: 'findOne', description: 'findOne operation' })
  @ApiFieldMask()
  findOne(@Param('code') code: string) {
    return this.uomService.findOne(code);
  }

  @Post()
  @ApiBody({ type: CreateUomDto })
  @ApiCreatedResponse({ type: UomResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'create', description: 'create operation' })
  create(@Body() dto: CreateUomDto) {
    return this.uomService.create(dto);
  }

  @Patch(':code')
  @ApiBody({ type: UpdateUomDto })
  @ApiOkResponse({ type: UomResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'update', description: 'update operation' })
  update(@Param('code') code: string, @Body() dto: UpdateUomDto) {
    return this.uomService.update(code, dto);
  }

  @Delete(':code')
  @ApiOkResponse({ type: UomResponseDto })
  @CasbinAction('write')
  @ApiOperation({ summary: 'remove', description: 'remove operation' })
  remove(@Param('code') code: string) {
    return this.uomService.delete(code);
  }
}
