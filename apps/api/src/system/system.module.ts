import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SystemController],
})
export class SystemModule {}
