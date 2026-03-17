import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SuppliersWriteService } from './suppliers-write.service';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, SuppliersWriteService],
})
export class SuppliersModule {}
