import { Module } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { TaxCategoriesController } from './tax-categories.controller';
import { TaxCategoriesService } from './tax-categories.service';
import { TaxPositionMappingsController } from './tax-position-mappings.controller';
import { TaxPositionsController } from './tax-positions.controller';
import { TaxPositionsService } from './tax-positions.service';
import { TaxReportsController } from './tax-reports.controller';
import { TaxReportsService } from './tax-reports.service';
import { TaxResolutionEngine } from './tax-resolution.engine';

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
