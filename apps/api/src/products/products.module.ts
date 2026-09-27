import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsWriteService } from './products-write.service';
import { ProductsService } from './products.service';
import { ProductGroupsService } from './product-groups.service';
import { ProductGroupsController } from './product-groups.controller';
import { ProductCopyService } from './product-copy.service';
import { ProductComponentsService } from './product-components.service';
import { ProductMediaService } from './product-media.service';

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
