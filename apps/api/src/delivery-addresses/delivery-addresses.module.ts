import { Module } from '@nestjs/common';
import { DeliveryAddressesController } from './delivery-addresses.controller';
import { DeliveryAddressesService } from './delivery-addresses.service';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [DeliveryAddressesController],
  providers: [DeliveryAddressesService],
  exports: [DeliveryAddressesService],
})
export class DeliveryAddressesModule {}
