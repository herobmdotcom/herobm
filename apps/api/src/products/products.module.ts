import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsWriteService } from './products-write.service';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductsWriteService],
  exports: [ProductsService, ProductsWriteService],
})
export class ProductsModule {}
