import { Module } from '@nestjs/common';
import { TaxCategoriesService } from './tax-categories.service';
import { TaxCategoriesController } from './tax-categories.controller';
import { TaxPositionsService } from './tax-positions.service';
import { TaxPositionsController } from './tax-positions.controller';
import { TaxPositionMappingsController } from './tax-position-mappings.controller';
import { TaxResolutionEngine } from './tax-resolution.engine';
import { TaxBasService } from './tax-bas.service';
import { TaxBasController } from './tax-bas.controller';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [
    TaxCategoriesController,
    TaxPositionMappingsController,
    TaxPositionsController,
    TaxBasController,
  ],
  providers: [
    TaxCategoriesService,
    TaxPositionsService,
    TaxResolutionEngine,
    TaxBasService,
  ],
  exports: [
    TaxCategoriesService,
    TaxPositionsService,
    TaxResolutionEngine,
    TaxBasService,
  ],
})
export class TaxModule {}
