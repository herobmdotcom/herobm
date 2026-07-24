import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomersWriteService } from './customers-write.service';
import { CustomerGroupsController } from './customer-groups.controller';
import { CustomerGroupsService } from './customer-groups.service';

import { CreditAssessmentService } from './credit-assessment.service';

@Module({
  controllers: [CustomersController, CustomerGroupsController],
  providers: [
    CustomersService,
    CustomersWriteService,
    CustomerGroupsService,
    CreditAssessmentService,
  ],
  exports: [
    CustomersService,
    CustomersWriteService,
    CustomerGroupsService,
    CreditAssessmentService,
  ],
})
export class CustomersModule {}
