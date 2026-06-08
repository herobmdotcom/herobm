import { SystemResource } from '@modbm/shared';
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
  ReceiveReturnDto,
  ReturnResponseDto,
  ChangeReturnStateDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@ApiTags('Orders')
@Controller('sales-orders')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SALES_RETURNS)
export class OrderReturnsController {
  constructor(private readonly returnsWriteService: ReturnsWriteService) {}

  @Post(':id/returns')
  @ApiCreatedResponse({ type: ReturnResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Return',
    description: 'Create a new customer return (RMA) against a sales order.',
  })
  createReturn(
    @Param('id') id: string,
    @Body() body: CreateReturnDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.createReturn(id, body, user.username);
  }

  @Get(':id/returns')
  @ApiOkResponse({ type: ReturnResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Order Returns',
    description: 'Retrieve all returns associated with a specific sales order.',
  })
  findReturns(@Param('id') id: string) {
    return this.returnsWriteService.findByOrder(id);
  }

  @Get(':id/returns/:returnId')
  @ApiOkResponse({ type: ReturnResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Return',
    description: 'Retrieve detailed information for a specific return.',
  })
  findReturn(@Param('id') _id: string, @Param('returnId') returnId: string) {
    return this.returnsWriteService.findOne(returnId);
  }

  @Patch(':id/returns/:returnId')
  @ApiOkResponse({ type: ReturnResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Return',
    description: 'Modify the details or metadata of an existing return.',
  })
  updateReturn(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() body: UpdateReturnDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.updateReturn(returnId, body, user.username);
  }

  @Patch(':id/returns/:returnId/state')
  @ApiOkResponse({ type: ReturnResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Change Return State',
    description: 'Update the processing state of a sales return.',
  })
  changeReturnState(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() dto: ChangeReturnStateDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.changeReturnState(
      returnId,
      dto.stateCode,
      user.username,
      dto.locationId,
    );
  }

  @Post(':id/returns/:returnId/lines')
  @ApiCreatedResponse({ type: ReturnResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Return Line',
    description: 'Add a new line item to a sales return.',
  })
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
  @ApiOkResponse({ type: ReturnResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Return Line',
    description: 'Modify an existing line item on a sales return.',
  })
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

  @Post(':id/returns/:returnId/receive')
  @ApiCreatedResponse({ type: ReturnResponseDto })
  @CasbinAction('handle')
  @ApiOperation({
    summary: 'Receive Return',
    description: 'Process the receipt of returned goods into inventory.',
  })
  receiveReturn(
    @Param('id') _id: string,
    @Param('returnId') returnId: string,
    @Body() body: ReceiveReturnDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.returnsWriteService.receiveReturnLines(
      returnId,
      body,
      user.username,
    );
  }

  @Delete(':id/returns/:returnId/lines/:lineId')
  @ApiOkResponse({ type: ReturnResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Return Line',
    description: 'Delete a line item from a sales return.',
  })
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
