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
import { CostCentersService } from './cost-centers.service';
import { CostCentersController } from './cost-centers.controller';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { AppConfigController } from './app-config.controller';

@Global()
@Module({
  controllers: [
    UomDictionaryController,
    ExchangeRatesController,
    OrganizationController,
    AppConfigController,
    TradingTermsController,
    CostCentersController,
    ActivitiesController,
  ],
  providers: [
    UomDictionaryService,
    ExchangeRatesService,
    OrganizationService,
    AppConfigService,
    TradingTermsService,
    CostCentersService,
    ActivitiesService,
  ],
  exports: [
    UomDictionaryService,
    ExchangeRatesService,
    OrganizationService,
    AppConfigService,
    TradingTermsService,
    CostCentersService,
    ActivitiesService,
  ],
})
export class SettingsModule {}
