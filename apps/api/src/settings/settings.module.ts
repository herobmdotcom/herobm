import { Module } from '@nestjs/common';
import { UomDictionaryService } from './uom-dictionary.service';
import { UomDictionaryController } from './uom-dictionary.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRatesController } from './exchange-rates.controller';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';

@Module({
  controllers: [
    UomDictionaryController,
    ExchangeRatesController,
    OrganizationController,
  ],
  providers: [UomDictionaryService, ExchangeRatesService, OrganizationService],
  exports: [UomDictionaryService, ExchangeRatesService, OrganizationService],
})
export class SettingsModule {}
