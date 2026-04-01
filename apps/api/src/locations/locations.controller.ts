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
import { CreateLocationDto, CreateZoneDto, CreateBinDto } from './dto';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ── Locations ─────────────────────────────────────────────────────────────

  @Post('locations')
  @CasbinAction('write')
  createLocation(@Body() dto: CreateLocationDto, @Req() req: any) {
    return this.locationsService.createLocation(dto, req.user?.userId);
  }

  @Patch('locations/:id')
  @CasbinAction('write')
  updateLocation(
    @Param('id') id: string,
    @Body() dto: Partial<CreateLocationDto>,
  ) {
    return this.locationsService.updateLocation(id, dto);
  }

  @Delete('locations/:id')
  @CasbinAction('write')
  deleteLocation(@Param('id') id: string) {
    return this.locationsService.deleteLocation(id);
  }

  // ── Zones ─────────────────────────────────────────────────────────────────

  @Post('zones')
  @CasbinAction('write')
  createZone(@Body() dto: CreateZoneDto, @Req() req: any) {
    return this.locationsService.createZone(dto, req.user?.userId);
  }

  @Patch('zones/:id')
  @CasbinAction('write')
  updateZone(@Param('id') id: string, @Body() dto: Partial<CreateZoneDto>) {
    return this.locationsService.updateZone(id, dto);
  }

  @Delete('zones/:id')
  @CasbinAction('write')
  deleteZone(@Param('id') id: string) {
    return this.locationsService.deleteZone(id);
  }

  // ── Bins ──────────────────────────────────────────────────────────────────

  @Post('bins')
  @CasbinAction('write')
  createBin(@Body() dto: CreateBinDto, @Req() req: any) {
    return this.locationsService.createBin(dto, req.user?.userId);
  }

  @Patch('bins/:id')
  @CasbinAction('write')
  updateBin(@Param('id') id: string, @Body() dto: Partial<CreateBinDto>) {
    return this.locationsService.updateBin(id, dto);
  }

  @Delete('bins/:id')
  @CasbinAction('write')
  deleteBin(@Param('id') id: string) {
    return this.locationsService.deleteBin(id);
  }
}
