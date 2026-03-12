import { Module } from '@nestjs/common';
import { GstCategoriesService } from './gst-categories.service';
import { GstCategoriesController } from './gst-categories.controller';
import { DrizzleModule } from '../drizzle/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [GstCategoriesController],
  providers: [GstCategoriesService],
  exports: [GstCategoriesService],
})
export class GstModule {}
