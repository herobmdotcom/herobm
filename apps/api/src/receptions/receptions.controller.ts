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
import { ReceptionsService } from './receptions.service';
import { AuthGuard } from '@nestjs/passport';
import { PaginationQuery } from '../common/pagination';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { CreateReceptionDto } from './dto';

@UseGuards(AuthGuard('jwt'), CasbinGuard)
@Controller('receptions')
@CasbinResource('receptions')
export class ReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) {}

  @Post()
  @CasbinAction('write')
  async create(
    @Body() createReceptionDto: CreateReceptionDto,
    @Req() req: any,
  ) {
    return this.receptionsService.create(createReceptionDto, req.user.username);
  }

  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: PaginationQuery) {
    return this.receptionsService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.receptionsService.findOne(id);
  }
}
