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
@Controller('purchase-orders/:orderId/receptions')
@CasbinResource('purchase-orders')
export class ReceptionsController {
  constructor(private readonly receptionsService: ReceptionsService) {}

  @Post()
  @CasbinAction('write')
  async create(
    @Param('orderId') orderId: string,
    @Body() createReceptionDto: CreateReceptionDto,
    @Req() req: any,
  ) {
    // Optionally validate that orderId from path matches DTO if desired...
    return this.receptionsService.create(createReceptionDto, req.user.username);
  }

  @Get()
  @CasbinAction('read')
  async findAll(@Param('orderId') orderId: string, @Query() query: PaginationQuery) {
    // Note: ReceptionsService.findAll currently doesn't filter by orderId,
    // this keeps the existing behavior but nests the route.
    return this.receptionsService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('orderId') orderId: string, @Param('id') id: string) {
    return this.receptionsService.findOne(id);
  }
}
