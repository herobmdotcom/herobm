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
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { EncryptionService } from '../common/encryption.service';

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
