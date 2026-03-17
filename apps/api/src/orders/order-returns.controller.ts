import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReturnsWriteService } from './returns-write.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreateReturnDto,
  UpdateReturnDto,
  AddReturnLineDto,
  UpdateReturnLineDto,
} from './dto';

@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('orders')
export class OrderReturnsController {
  constructor(private readonly returnsWriteService: ReturnsWriteService) {}

  @Post(':id/returns')
  @CasbinAction('write')
  createReturn(
    @Param('id') id: string,
    @Body() body: CreateReturnDto,
    @Req() req: any,
  ) {
    return this.returnsWriteService.createReturn(id, body, req.user.username);
  }

  @Get(':id/returns')
  @CasbinAction('read')
  findReturns(@Param('id') id: string) {
    return this.returnsWriteService.findByOrder(id);
  }

  @Get(':id/returns/:returnId')
  @CasbinAction('read')
  findReturn(@Param('id') _id: string, @Param('returnId') returnId: string) {
    return this.returnsWriteService.findOne(returnId);
  }

  @Patch(':id/returns/:returnId')
  @CasbinAction('write')
  updateReturn(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() body: UpdateReturnDto,
    @Req() req: any,
  ) {
    return this.returnsWriteService.updateReturn(
      returnId,
      body,
      req.user.username,
    );
  }

  @Patch(':id/returns/:returnId/state')
  @CasbinAction('write')
  changeReturnState(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body('stateCode') stateCode: string,
    @Req() req: any,
  ) {
    return this.returnsWriteService.changeReturnState(
      returnId,
      stateCode,
      req.user.username,
    );
  }

  @Post(':id/returns/:returnId/lines')
  @CasbinAction('write')
  addReturnLine(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() body: AddReturnLineDto,
    @Req() req: any,
  ) {
    return this.returnsWriteService.addReturnLine(
      returnId,
      body,
      req.user.username,
    );
  }

  @Patch(':id/returns/:returnId/lines/:lineId')
  @CasbinAction('write')
  updateReturnLine(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateReturnLineDto,
    @Req() req: any,
  ) {
    return this.returnsWriteService.updateReturnLine(
      returnId,
      lineId,
      body,
      req.user.username,
    );
  }

  @Delete(':id/returns/:returnId/lines/:lineId')
  @CasbinAction('write')
  removeReturnLine(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Param('lineId') lineId: string,
    @Req() req: any,
  ) {
    return this.returnsWriteService.removeReturnLine(
      returnId,
      lineId,
      req.user.username,
    );
  }
}
