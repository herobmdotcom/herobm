import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [EventsController],
})
export class EventsModule {}
