import { Module } from '@nestjs/common';
import { TaxCategoriesService } from './tax-categories.service';
import { TaxCategoriesController } from './tax-categories.controller';
import { TaxPositionsService } from './tax-positions.service';
import { TaxPositionsController } from './tax-positions.controller';
import { TaxPositionMappingsController } from './tax-position-mappings.controller';
import { TaxResolutionEngine } from './tax-resolution.engine';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [
    TaxCategoriesController,
    TaxPositionMappingsController,
    TaxPositionsController,
  ],
  providers: [TaxCategoriesService, TaxPositionsService, TaxResolutionEngine],
  exports: [TaxCategoriesService, TaxPositionsService, TaxResolutionEngine],
})
export class TaxModule {}
