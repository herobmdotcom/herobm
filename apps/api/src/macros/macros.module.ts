import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { MacrosController } from './macros.controller';
import { MacrosService } from './macros.service';

@Module({
  imports: [DrizzleModule],
  controllers: [MacrosController],
  providers: [MacrosService],
  exports: [MacrosService],
})
export class MacrosModule {}
