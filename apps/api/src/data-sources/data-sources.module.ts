import { Global, Module } from '@nestjs/common';
import { DataSourcesRegistry } from './data-sources.registry';
import { DataSourcesController } from './data-sources.controller';

@Global()
@Module({
  controllers: [DataSourcesController],
  providers: [DataSourcesRegistry],
  exports: [DataSourcesRegistry],
})
export class DataSourcesModule {}
