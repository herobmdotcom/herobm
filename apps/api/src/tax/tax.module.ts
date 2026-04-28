import { Module } from '@nestjs/common';
import { TaxCategoriesService } from './tax-categories.service';
import { TaxCategoriesController } from './tax-categories.controller';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [TaxCategoriesController],
  providers: [TaxCategoriesService],
  exports: [TaxCategoriesService],
})
export class TaxModule {}
