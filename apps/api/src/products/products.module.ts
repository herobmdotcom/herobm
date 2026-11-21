import { Module } from '@nestjs/common';
import { ProductComponentsService } from './product-components.service';
import { ProductCopyService } from './product-copy.service';
import { ProductGroupsController } from './product-groups.controller';
import { ProductGroupsService } from './product-groups.service';
import { ProductMediaService } from './product-media.service';
import { ProductsWriteService } from './products-write.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, ProductGroupsController],
  providers: [
    ProductsService,
    ProductsWriteService,
    ProductCopyService,
    ProductComponentsService,
    ProductMediaService,
    ProductGroupsService,
  ],
  exports: [
    ProductsService,
    ProductsWriteService,
    ProductCopyService,
    ProductComponentsService,
    ProductMediaService,
    ProductGroupsService,
  ],
})
export class ProductsModule {}
