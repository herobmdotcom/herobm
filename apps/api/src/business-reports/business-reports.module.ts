import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { BusinessReportsController } from './business-reports.controller';
import { BusinessReportsService } from './business-reports.service';

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [BusinessReportsController],
  providers: [BusinessReportsService],
  exports: [BusinessReportsService],
})
export class BusinessReportsModule {}
