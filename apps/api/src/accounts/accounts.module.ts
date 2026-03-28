import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountsWriteService } from './accounts-write.service';
import { AccountGroupsController } from './account-groups.controller';
import { AccountGroupsService } from './account-groups.service';

@Module({
  controllers: [AccountsController, AccountGroupsController],
  providers: [AccountsService, AccountsWriteService, AccountGroupsService],
  exports: [AccountsService, AccountsWriteService, AccountGroupsService],
})
export class AccountsModule {}
