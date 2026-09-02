import { Module } from '@nestjs/common';
import { BusinessReportsController } from './business-reports.controller';
import { BusinessReportsService } from './business-reports.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [BusinessReportsController],
  providers: [BusinessReportsService],
  exports: [BusinessReportsService],
})
export class BusinessReportsModule {}
