import { Module } from '@nestjs/common';
import { MaController } from './ma.controller';
import { MaActorsController } from './ma.actors.controller';
import { MaService } from './ma.service';

@Module({
  controllers: [MaController, MaActorsController],
  providers: [MaService],
})
export class MaExtensionModule {}
