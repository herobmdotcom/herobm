import { Module } from '@nestjs/common';
import { AccountsController } from './customers.controller';
import { AccountsService } from './customers.service';
import { AccountsWriteService } from './customers-write.service';
import { AccountGroupsController } from './customer-groups.controller';
import { AccountGroupsService } from './customer-groups.service';

import { CreditAssessmentService } from './credit-assessment.service';

@Module({
  controllers: [AccountsController, AccountGroupsController],
  providers: [
    AccountsService,
    AccountsWriteService,
    AccountGroupsService,
    CreditAssessmentService,
  ],
  exports: [
    AccountsService,
    AccountsWriteService,
    AccountGroupsService,
    CreditAssessmentService,
  ],
})
export class AccountsModule {}
