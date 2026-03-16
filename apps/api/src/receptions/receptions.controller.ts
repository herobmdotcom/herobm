import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReceptionsService, ReceptionSearchParams } from './receptions.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@UseGuards(AuthGuard('jwt'), CasbinGuard)
@Controller('receptions')
@CasbinResource('receptions')
export class ReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) { }

  @Post()
  @CasbinAction('write')
  async create(@Body() createReceptionDto: any, @Req() req: any) {
    const user = req.user;
    return this.receptionsService.create(createReceptionDto, user.sub);
  }

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: ReceptionSearchParams) {
    return this.receptionsService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.receptionsService.findOne(id);
  }
}
