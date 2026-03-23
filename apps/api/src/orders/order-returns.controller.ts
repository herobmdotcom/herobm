import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@Controller('sales-orders')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('sales-orders')
export class OrderReturnsController {
  constructor(private readonly returnsWriteService: ReturnsWriteService) {}

  @Post(':id/returns')
  @CasbinAction('write')
  createReturn(
    @Param('id') id: string,
    @Body() body: CreateReturnDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.createReturn(id, body, user.username);
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
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.updateReturn(returnId, body, user.username);
  }

  @Patch(':id/returns/:returnId/state')
  @CasbinAction('write')
  changeReturnState(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body('stateCode') stateCode: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.changeReturnState(
      returnId,
      stateCode,
      user.username,
    );
  }

  @Post(':id/returns/:returnId/lines')
  @CasbinAction('write')
  addReturnLine(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() body: AddReturnLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.addReturnLine(
      returnId,
      body,
      user.username,
    );
  }

  @Patch(':id/returns/:returnId/lines/:lineId')
  @CasbinAction('write')
  updateReturnLine(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateReturnLineDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.updateReturnLine(
      returnId,
      lineId,
      body,
      user.username,
    );
  }

  @Delete(':id/returns/:returnId/lines/:lineId')
  @CasbinAction('write')
  removeReturnLine(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Param('lineId') lineId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.removeReturnLine(
      returnId,
      lineId,
      user.username,
    );
  }
}
