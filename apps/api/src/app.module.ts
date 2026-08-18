import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { CasbinGuard } from './auth/casbin.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ApiThrottlerGuard } from './auth/api-throttler.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { RATE_LIMITS } from './common/config/throttler.config';
import { DrizzleModule } from './drizzle/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TaxModule } from './tax/tax.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { MetricsInterceptor } from './common/metrics.interceptor';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { PurchaseDebitNotesModule } from './purchase-debit-notes/purchase-debit-notes.module';
import { ManufacturingModule } from './manufacturing/manufacturing.module';

import { PdfTemplatesModule } from './pdf-templates/pdf-templates.module';
import { StorageModule } from './common/storage/storage.module';
import { DataSourcesModule } from './data-sources/data-sources.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InvoicesModule } from './invoices/invoices.module';
import { GlModule } from './gl/gl.module';
import { SystemModule } from './system/system.module';
import { SettingsModule } from './settings/settings.module';
import { LocationsModule } from './locations/locations.module';
import { SetupModule } from './setup/setup.module';
import { GoodsReceivedModule } from './goods-received/goods-received.module';
import { MacrosModule } from './macros/macros.module';
import { UsersModule } from './users/users.module';
import { PaymentsModule } from './payments/payments.module';
import { PricingModule } from './pricing/pricing.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { EventsModule } from './events/events.module';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { EmailModule } from './email/email.module';
import { DeliveryAddressesModule } from './delivery-addresses/delivery-addresses.module';

import { RolesModule } from './roles/roles.module';
import { BusinessReportsModule } from './business-reports/business-reports.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { ContactsModule } from './contacts/contacts.module';
import { ActorsModule } from './actors/actors.module';
import { ProjectsModule } from './projects/projects.module';
import { CrmMapModule } from './crm-map/crm-map.module';
import { HelpModule } from './help/help.module';
import { extensionModules } from './generated/extension-modules';

import { ReadOnlyGuard } from './common/guards/read-only.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: RATE_LIMITS.DEFAULT.ttl,
        limit: RATE_LIMITS.DEFAULT.limit,
      },
      {
        name: 'api',
        ttl: RATE_LIMITS.API.ttl,
        limit: RATE_LIMITS.API.limit,
      },
    ]),
    DrizzleModule,
    AuthModule,
    RolesModule,
    CustomersModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    InvoicesModule,
    PaymentsModule,
    DashboardModule,
    TaxModule,
    TelemetryModule,
    SuppliersModule,
    PurchaseOrdersModule,
    PurchaseDebitNotesModule,
    ManufacturingModule,

    StorageModule,
    DataSourcesModule,
    PdfTemplatesModule,
    NotificationsModule,
    GlModule,
    SystemModule,
    SettingsModule,
    LocationsModule,
    SetupModule,
    GoodsReceivedModule,
    MacrosModule,
    UsersModule,
    PricingModule,
    WebhooksModule,
    ApiKeysModule,
    EventsModule,
    EnrichmentModule,
    EmailModule,
    BusinessReportsModule,
    UserSettingsModule,
    ContactsModule,
    DeliveryAddressesModule,
    ActorsModule,
    ProjectsModule,
    CrmMapModule,
    HelpModule,
    ...extensionModules,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_GUARD, useClass: ApiThrottlerGuard },
    { provide: APP_GUARD, useClass: ReadOnlyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CasbinGuard },
  ],
})
export class AppModule {}
