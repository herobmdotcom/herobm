import { SystemResource } from '@herobm/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import {
  CreateTaxPositionDto,
  TaxPositionResponseDto,
  UpdateTaxPositionDto,
} from './tax-positions.dto';
import { TaxPositionsService } from './tax-positions.service';

@ApiTags('Tax')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@CasbinResource(SystemResource.SETTINGS)
@Controller('tax-positions')
export class TaxPositionsController {
  constructor(private readonly taxPositionsService: TaxPositionsService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List all tax positions',
    description: 'Retrieves a list of all configured tax positions.',
  })
  @ApiOkResponse({ type: [TaxPositionResponseDto] })
  async findAll() {
    return this.taxPositionsService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get a tax position by id',
    description: 'Retrieves a specific tax position by its unique identifier.',
  })
  @ApiOkResponse({ type: TaxPositionResponseDto })
  async findOne(@Param('id') id: string) {
    return this.taxPositionsService.getById(id);
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create a new tax position',
    description: 'Creates a new tax position for business context tax rules.',
  })
  @ApiCreatedResponse({ type: TaxPositionResponseDto })
  async create(@Body() createDto: CreateTaxPositionDto) {
    return this.taxPositionsService.create(createDto);
  }

  @Put(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update a tax position',
    description: 'Updates an existing tax position.',
  })
  @ApiOkResponse({ type: TaxPositionResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateTaxPositionDto,
  ) {
    return this.taxPositionsService.update(id, updateDto);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete a tax position',
    description:
      'Deletes a tax position. This will also cascade delete any associated mappings.',
  })
  @ApiOkResponse({ type: TaxPositionResponseDto })
  async remove(@Param('id') id: string) {
    return this.taxPositionsService.remove(id);
  }
}
