import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TaxPositionsService } from './tax-positions.service';
import {
  CreateTaxPositionDto,
  UpdateTaxPositionDto,
  TaxPositionResponseDto,
} from './tax-positions.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SkipCasbin } from '../auth/casbin.guard';

@ApiTags('Tax')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@SkipCasbin()
@Controller('tax-positions')
export class TaxPositionsController {
  constructor(private readonly taxPositionsService: TaxPositionsService) {}

  @Get()
  @SkipCasbin()
  @ApiOperation({
    summary: 'List all tax positions',
    description: 'Retrieves a list of all configured tax positions.',
  })
  @ApiOkResponse({ type: [TaxPositionResponseDto] })
  async findAll() {
    return this.taxPositionsService.findAll();
  }

  @Get(':id')
  @SkipCasbin()
  @ApiOperation({
    summary: 'Get a tax position by id',
    description: 'Retrieves a specific tax position by its unique identifier.',
  })
  @ApiOkResponse({ type: TaxPositionResponseDto })
  async findOne(@Param('id') id: string) {
    return this.taxPositionsService.getById(id);
  }

  @Post()
  @SkipCasbin()
  @ApiOperation({
    summary: 'Create a new tax position',
    description: 'Creates a new tax position for business context tax rules.',
  })
  @ApiCreatedResponse({ type: TaxPositionResponseDto })
  async create(@Body() createDto: CreateTaxPositionDto) {
    return this.taxPositionsService.create(createDto);
  }

  @Put(':id')
  @SkipCasbin()
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
  @SkipCasbin()
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
