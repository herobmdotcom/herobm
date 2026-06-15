import {
  Controller,
  Get,
  Post,
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
  CreateTaxPositionMappingDto,
  TaxPositionMappingResponseDto,
} from './tax-positions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SkipCasbin } from '../auth/casbin.guard';

@ApiTags('Tax')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@SkipCasbin()
@Controller('tax-positions')
export class TaxPositionMappingsController {
  constructor(private readonly taxPositionsService: TaxPositionsService) {}

  @Get('mappings')
  @SkipCasbin()
  @ApiOperation({
    summary: 'List all tax position mappings (ignores path param for now)',
    description:
      'Retrieves all mappings across all tax positions. In the future this may be scoped.',
  })
  @ApiOkResponse({ type: [TaxPositionMappingResponseDto] })
  async findAll() {
    return this.taxPositionsService.findMappings();
  }

  @Post(':taxPositionId/mappings')
  @SkipCasbin()
  @ApiOperation({
    summary: 'Create a new mapping for a tax position',
    description:
      'Creates a mapping rule that translates a source tax category to a destination category for this position.',
  })
  @ApiCreatedResponse({ type: TaxPositionMappingResponseDto })
  async create(
    @Param('taxPositionId') taxPositionId: string,
    @Body() createDto: CreateTaxPositionMappingDto,
  ) {
    return this.taxPositionsService.createMapping(taxPositionId, createDto);
  }

  @Delete(':taxPositionId/mappings/:sourceTaxCategoryId')
  @SkipCasbin()
  @ApiOperation({
    summary: 'Remove a mapping from a tax position',
    description: 'Deletes a specific tax category mapping from a tax position.',
  })
  @ApiOkResponse({ type: TaxPositionMappingResponseDto })
  async remove(
    @Param('taxPositionId') taxPositionId: string,
    @Param('sourceTaxCategoryId') sourceTaxCategoryId: string,
  ) {
    return this.taxPositionsService.removeMapping(
      taxPositionId,
      sourceTaxCategoryId,
    );
  }
}
