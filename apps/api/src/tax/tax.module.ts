import { Module } from '@nestjs/common';
import { TaxCategoriesService } from './tax-categories.service';
import { TaxCategoriesController } from './tax-categories.controller';
import { TaxPositionsService } from './tax-positions.service';
import { TaxPositionsController } from './tax-positions.controller';
import { TaxPositionMappingsController } from './tax-position-mappings.controller';
import { TaxResolutionEngine } from './tax-resolution.engine';
import { TaxReportsService } from './tax-reports.service';
import { TaxReportsController } from './tax-reports.controller';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [
    TaxCategoriesController,
    TaxPositionMappingsController,
    TaxPositionsController,
    TaxReportsController,
  ],
  providers: [
    TaxCategoriesService,
    TaxPositionsService,
    TaxResolutionEngine,
    TaxReportsService,
  ],
  exports: [
    TaxCategoriesService,
    TaxPositionsService,
    TaxResolutionEngine,
    TaxReportsService,
  ],
})
export class TaxModule {}
