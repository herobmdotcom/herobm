import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { CrmActivitiesController } from './crm-activities.controller';
import { CrmActivitiesService } from './crm-activities.service';

@Module({
  imports: [DrizzleModule],
  controllers: [CrmActivitiesController],
  providers: [CrmActivitiesService],
  exports: [CrmActivitiesService],
})
export class CrmActivitiesModule {}
