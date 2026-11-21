import { Global, Module } from '@nestjs/common';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesRegistry } from './data-sources.registry';

@Global()
@Module({
  controllers: [DataSourcesController],
  providers: [DataSourcesRegistry],
  exports: [DataSourcesRegistry],
})
export class DataSourcesModule {}
