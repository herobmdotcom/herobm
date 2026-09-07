import { Module } from '@nestjs/common';
import { CrmActivitiesController } from './crm-activities.controller';
import { CrmActivitiesService } from './crm-activities.service';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [CrmActivitiesController],
  providers: [CrmActivitiesService],
  exports: [CrmActivitiesService],
})
export class CrmActivitiesModule {}
