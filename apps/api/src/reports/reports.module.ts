import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsRegistry } from './reports.registry';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRegistry],
  exports: [ReportsService, ReportsRegistry],
})
export class ReportsModule {}
