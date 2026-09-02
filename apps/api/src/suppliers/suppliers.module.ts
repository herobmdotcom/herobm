import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SuppliersWriteService } from './suppliers-write.service';
import { SupplierGroupsController } from './supplier-groups.controller';
import { SupplierGroupsService } from './supplier-groups.service';

@Module({
  controllers: [SuppliersController, SupplierGroupsController],
  providers: [SuppliersService, SuppliersWriteService, SupplierGroupsService],
  exports: [SuppliersService, SuppliersWriteService, SupplierGroupsService],
})
export class SuppliersModule {}
