import { Module } from '@nestjs/common';
import { GlService } from './gl.service';
import { GlController } from './gl.controller';
import { CoaLoaderService } from './coa-loader.service';

@Module({
  controllers: [GlController],
  providers: [GlService, CoaLoaderService],
  exports: [GlService, CoaLoaderService],
})
export class GlModule {}
