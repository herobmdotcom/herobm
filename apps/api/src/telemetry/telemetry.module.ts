import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TelemetryController } from './telemetry.controller';

@Module({
  controllers: [TelemetryController, HealthController],
})
export class TelemetryModule {}
