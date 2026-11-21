import { Module } from '@nestjs/common';
import { DiscountMatrixController } from './discount-matrix.controller';
import { DiscountMatrixService } from './discount-matrix.service';

@Module({
  controllers: [DiscountMatrixController],
  providers: [DiscountMatrixService],
  exports: [DiscountMatrixService],
})
export class PricingModule {}
