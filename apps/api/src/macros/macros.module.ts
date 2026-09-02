import { Module } from '@nestjs/common';
import { MacrosController } from './macros.controller';
import { MacrosService } from './macros.service';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [MacrosController],
  providers: [MacrosService],
  exports: [MacrosService],
})
export class MacrosModule {}
