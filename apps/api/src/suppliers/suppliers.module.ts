import { Module } from '@nestjs/common';
import { SupplierGroupsController } from './supplier-groups.controller';
import { SupplierGroupsService } from './supplier-groups.service';
import { SuppliersWriteService } from './suppliers-write.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [SuppliersController, SupplierGroupsController],
  providers: [SuppliersService, SuppliersWriteService, SupplierGroupsService],
  exports: [SuppliersService, SuppliersWriteService, SupplierGroupsService],
})
export class SuppliersModule {}
