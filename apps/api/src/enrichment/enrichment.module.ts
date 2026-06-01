import { Module } from '@nestjs/common';
import { EnrichmentController } from './enrichment.controller';
import { EnrichmentService } from './enrichment.service';
import { AbrProvider } from './providers/abr.provider';
import { TaxJarProvider } from './providers/taxjar.provider';
import { AuthModule } from '../auth/auth.module';
import { EncryptionService } from '../common/encryption.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [EnrichmentController],
  providers: [
    EnrichmentService,
    AbrProvider,
    TaxJarProvider,
    EncryptionService,
  ],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
