import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { LocationsService } from './locations.service';
import {
  CreateLocationDto,
  CreateZoneDto,
  CreateBinDto,
  UpdateLocationDto,
  UpdateZoneDto,
  UpdateBinDto,
  LocationResponseDto,
  ZoneResponseDto,
  BinResponseDto,
} from './dto';

@ApiTags('Locations')
@Controller('inventory')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('settings')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ── Locations ─────────────────────────────────────────────────────────────

  @Post('locations')
  @ApiBody({ type: CreateLocationDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Location',
    description: 'Create a new warehouse location.',
  })
  @ApiCreatedResponse({ type: LocationResponseDto })
  createLocation(@Body() dto: CreateLocationDto, @Req() req: any) {
    return this.locationsService.createLocation(dto, req.user?.userId);
  }

  @Patch('locations/:id')
  @ApiBody({ type: UpdateLocationDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Location',
    description: 'Modify the details of an existing warehouse location.',
  })
  @ApiOkResponse({ type: LocationResponseDto })
  updateLocation(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.updateLocation(id, dto);
  }

  @Delete('locations/:id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Location',
    description: 'Remove a warehouse location.',
  })
  @ApiOkResponse({ type: LocationResponseDto })
  deleteLocation(@Param('id') id: string) {
    return this.locationsService.deleteLocation(id);
  }

  // ── Zones ─────────────────────────────────────────────────────────────────

  @Post('zones')
  @ApiBody({ type: CreateZoneDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Zone',
    description: 'Create a new storage zone.',
  })
  @ApiCreatedResponse({ type: ZoneResponseDto })
  createZone(@Body() dto: CreateZoneDto, @Req() req: any) {
    return this.locationsService.createZone(dto, req.user?.userId);
  }

  @Patch('zones/:id')
  @ApiBody({ type: UpdateZoneDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Zone',
    description: 'Modify the details of an existing storage zone.',
  })
  @ApiOkResponse({ type: ZoneResponseDto })
  updateZone(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.locationsService.updateZone(id, dto);
  }

  @Delete('zones/:id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Zone',
    description: 'Remove a storage zone.',
  })
  @ApiOkResponse({ type: ZoneResponseDto })
  deleteZone(@Param('id') id: string) {
    return this.locationsService.deleteZone(id);
  }

  // ── Bins ──────────────────────────────────────────────────────────────────

  @Post('bins')
  @ApiBody({ type: CreateBinDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Bin',
    description: 'Create a new storage bin.',
  })
  @ApiCreatedResponse({ type: BinResponseDto })
  createBin(@Body() dto: CreateBinDto, @Req() req: any) {
    return this.locationsService.createBin(dto, req.user?.userId);
  }

  @Patch('bins/:id')
  @ApiBody({ type: UpdateBinDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Bin',
    description: 'Modify the details of an existing storage bin.',
  })
  @ApiOkResponse({ type: BinResponseDto })
  updateBin(@Param('id') id: string, @Body() dto: UpdateBinDto) {
    return this.locationsService.updateBin(id, dto);
  }

  @Delete('bins/:id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Bin',
    description: 'Remove a storage bin.',
  })
  @ApiOkResponse({ type: BinResponseDto })
  deleteBin(@Param('id') id: string) {
    return this.locationsService.deleteBin(id);
  }
}
