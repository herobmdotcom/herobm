  // security-ignore: dto-validation\nimport { SystemResource } from '@herobm/shared';
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
  Body,
  Param,
} from '@nestjs/common';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
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

@ApiTags('Warehouse')
@Controller('inventory')
@CasbinResource(SystemResource.SETTINGS)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ── Locations ─────────────────────────────────────────────────────────────

  @Get('locations/:id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Location',
    description:
      'Retrieve a specific warehouse location by ID, including its address details.',
  })
  @ApiOkResponse({ type: LocationResponseDto })
  getLocation(@Param('id') id: string) {
    return this.locationsService.getLocation(id);
  }

  @Post('locations')
  @ApiBody({ type: CreateLocationDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Location',
    description: 'Create a new warehouse location.',
  })
  @ApiCreatedResponse({ type: LocationResponseDto })
  createLocation(@Body() dto: CreateLocationDto, @AuthUser() user: JwtUser) {
    return this.locationsService.createLocation(dto, user?.userId);
  }

  @Patch('locations/:id')
  @ApiBody({ type: UpdateLocationDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Location',
    description: 'Modify the details of an existing warehouse location.',
  })
  @ApiOkResponse({ type: LocationResponseDto })
  updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.locationsService.updateLocation(id, dto, user?.userId);
  }

  @Delete('locations/:id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Location',
    description: 'Remove a warehouse location.',
  })
  @ApiOkResponse({ type: LocationResponseDto })
  deleteLocation(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.locationsService.deleteLocation(id, user?.userId);
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
  createZone(@Body() dto: CreateZoneDto, @AuthUser() user: JwtUser) {
    return this.locationsService.createZone(dto, user?.userId);
  }

  @Patch('zones/:id')
  @ApiBody({ type: UpdateZoneDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Zone',
    description: 'Modify the details of an existing storage zone.',
  })
  @ApiOkResponse({ type: ZoneResponseDto })
  updateZone(
    @Param('id') id: string,
    @Body() dto: UpdateZoneDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.locationsService.updateZone(id, dto, user?.userId);
  }

  @Delete('zones/:id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Zone',
    description: 'Remove a storage zone.',
  })
  @ApiOkResponse({ type: ZoneResponseDto })
  deleteZone(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.locationsService.deleteZone(id, user?.userId);
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
  createBin(@Body() dto: CreateBinDto, @AuthUser() user: JwtUser) {
    return this.locationsService.createBin(dto, user?.userId);
  }

  @Patch('bins/:id')
  @ApiBody({ type: UpdateBinDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Bin',
    description: 'Modify the details of an existing storage bin.',
  })
  @ApiOkResponse({ type: BinResponseDto })
  updateBin(
    @Param('id') id: string,
    @Body() dto: UpdateBinDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.locationsService.updateBin(id, dto, user?.userId);
  }

  @Delete('bins/:id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Bin',
    description: 'Remove a storage bin.',
  })
  @ApiOkResponse({ type: BinResponseDto })
  deleteBin(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.locationsService.deleteBin(id, user?.userId);
  }
}
