import { Global, Module } from '@nestjs/common';
import { UomDictionaryService } from './uom-dictionary.service';
import { UomDictionaryController } from './uom-dictionary.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRatesController } from './exchange-rates.controller';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { AppConfigService } from './app-config.service';
import { TradingTermsService } from './trading-terms.service';
import { TradingTermsController } from './trading-terms.controller';

@Global()
@Module({
  controllers: [
    UomDictionaryController,
    ExchangeRatesController,
    OrganizationController,
    TradingTermsController,
  ],
  providers: [
    UomDictionaryService,
    ExchangeRatesService,
    OrganizationService,
    AppConfigService,
    TradingTermsService,
  ],
  exports: [
    UomDictionaryService,
    ExchangeRatesService,
    OrganizationService,
    AppConfigService,
    TradingTermsService,
  ],
})
export class SettingsModule {}
