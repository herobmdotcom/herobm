import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { EventsController } from './events.controller';

@Module({
  imports: [DrizzleModule],
  controllers: [EventsController],
})
export class EventsModule {}
