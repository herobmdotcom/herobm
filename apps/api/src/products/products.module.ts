import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsWriteService } from './products-write.service';
import { ProductsService } from './products.service';
import { ProductGroupsService } from './product-groups.service';
import { ProductGroupsController } from './product-groups.controller';

@Module({
  controllers: [ProductsController, ProductGroupsController],
  providers: [ProductsService, ProductsWriteService, ProductGroupsService],
  exports: [ProductsService, ProductsWriteService, ProductGroupsService],
})
export class ProductsModule {}
