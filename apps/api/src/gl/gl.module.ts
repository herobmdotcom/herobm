import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { GlService } from './gl.service';
import { GlController } from './gl.controller';
import { CoaLoaderService } from './coa-loader.service';

@Module({
  controllers: [GlController],
  providers: [GlService, CoaLoaderService],
  exports: [GlService, CoaLoaderService],
})
export class GlModule implements OnModuleInit {
  private readonly logger = new Logger(GlModule.name);

  constructor(private readonly coaLoader: CoaLoaderService) {}

  async onModuleInit() {
    try {
      const result = await this.coaLoader.loadFromFile('au_standard.json');
      if (!result.skipped) {
        this.logger.log(
          `Chart of accounts seeded: ${result.created} accounts created`,
        );
      }
    } catch (err: any) {
      // Non-fatal: GL tables might not exist yet (pre-migration)
      this.logger.warn(`COA auto-seed skipped: ${err.message}`);
    }
  }
}
