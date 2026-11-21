import { Global, Module } from '@nestjs/common';
import { EncryptionService } from '../common/encryption.service';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { CostCentersController } from './cost-centers.controller';
import { CostCentersService } from './cost-centers.service';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { TradingTermsController } from './trading-terms.controller';
import { TradingTermsService } from './trading-terms.service';
import { UomDictionaryController } from './uom-dictionary.controller';
import { UomDictionaryService } from './uom-dictionary.service';

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
    LicenseController,
  ],
  providers: [
    UomDictionaryService,
    ExchangeRatesService,
    OrganizationService,
    AppConfigService,
    TradingTermsService,
    CostCentersService,
    ActivitiesService,
    LicenseService,
    EncryptionService,
  ],
  exports: [
    UomDictionaryService,
    ExchangeRatesService,
    OrganizationService,
    AppConfigService,
    TradingTermsService,
    CostCentersService,
    ActivitiesService,
    LicenseService,
  ],
})
export class SettingsModule {}
