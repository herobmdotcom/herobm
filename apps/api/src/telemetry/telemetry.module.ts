import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { HealthController } from './health.controller';

@Module({
  controllers: [TelemetryController, HealthController],
})
export class TelemetryModule {}
