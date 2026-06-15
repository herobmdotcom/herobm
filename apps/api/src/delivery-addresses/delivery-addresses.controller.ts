import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SystemResource } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { DeliveryAddressesService } from './delivery-addresses.service';
import {
  CreateDeliveryAddressDto,
  UpdateDeliveryAddressDto,
  DeliveryAddressResponseDto,
  DeleteDeliveryAddressSuccessDto,
} from './dto';

@ApiTags('Delivery Addresses')
@Controller('delivery-addresses')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.CUSTOMERS)
export class DeliveryAddressesController {
  constructor(
    private readonly deliveryAddressesService: DeliveryAddressesService,
  ) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create a new delivery address',
    description: 'Create a new delivery address for a customer.',
  })
  @ApiCreatedResponse({
    description: 'The created delivery address',
    type: DeliveryAddressResponseDto,
  })
  async create(
    @Body() dto: CreateDeliveryAddressDto,
  ): Promise<DeliveryAddressResponseDto> {
    return this.deliveryAddressesService.createDeliveryAddress(dto);
  }

  @Put(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update an existing delivery address',
    description: 'Update an existing delivery address.',
  })
  @ApiOkResponse({
    description: 'The updated delivery address',
    type: DeliveryAddressResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryAddressDto,
  ): Promise<DeliveryAddressResponseDto> {
    return this.deliveryAddressesService.updateDeliveryAddress(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete a delivery address',
    description: 'Delete a delivery address.',
  })
  @ApiOkResponse({
    description: 'Delivery address deleted',
    type: DeleteDeliveryAddressSuccessDto,
  })
  async remove(
    @Param('id') id: string,
  ): Promise<DeleteDeliveryAddressSuccessDto> {
    return this.deliveryAddressesService.deleteDeliveryAddress(id);
  }
}
