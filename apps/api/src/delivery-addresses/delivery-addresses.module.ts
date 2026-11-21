import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { DeliveryAddressesController } from './delivery-addresses.controller';
import { DeliveryAddressesService } from './delivery-addresses.service';

@Module({
  imports: [DrizzleModule],
  controllers: [DeliveryAddressesController],
  providers: [DeliveryAddressesService],
  exports: [DeliveryAddressesService],
})
export class DeliveryAddressesModule {}
