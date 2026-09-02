import { Module } from '@nestjs/common';
import { DiscountMatrixService } from './discount-matrix.service';
import { DiscountMatrixController } from './discount-matrix.controller';

@Module({
  controllers: [DiscountMatrixController],
  providers: [DiscountMatrixService],
  exports: [DiscountMatrixService],
})
export class PricingModule {}
