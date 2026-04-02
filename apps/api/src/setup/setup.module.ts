import { Module } from '@nestjs/common';
import { SetupService } from './setup.service';
import { SetupController } from './setup.controller';
import { GlModule } from '../gl/gl.module'; // for CoaLoaderService

@Module({
  imports: [GlModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
