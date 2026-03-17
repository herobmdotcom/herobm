import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountsWriteService } from './accounts-write.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountsWriteService],
  exports: [AccountsService, AccountsWriteService],
})
export class AccountsModule {}
