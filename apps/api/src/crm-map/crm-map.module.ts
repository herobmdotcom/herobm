import { Module } from '@nestjs/common';
import { CrmMapController } from './crm-map.controller';
import { CrmMapService } from './crm-map.service';

@Module({
  controllers: [CrmMapController],
  providers: [CrmMapService],
})
export class CrmMapModule {}
