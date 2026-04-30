import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './drizzle/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TaxModule } from './tax/tax.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { MetricsInterceptor } from './common/metrics.interceptor';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';

import { ReportsModule } from './reports/reports.module';
import { InvoicesModule } from './invoices/invoices.module';
import { GlModule } from './gl/gl.module';
import { SystemModule } from './system/system.module';
import { SettingsModule } from './settings/settings.module';
import { LocationsModule } from './locations/locations.module';
import { SetupModule } from './setup/setup.module';
import { GoodsReceivedModule } from './goods-received/goods-received.module';
import { MacrosModule } from './macros/macros.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    DrizzleModule,
    AuthModule,
    AccountsModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    InvoicesModule,
    DashboardModule,
    TaxModule,
    TelemetryModule,
    SuppliersModule,
    PurchaseOrdersModule,

    ReportsModule,
    GlModule,
    SystemModule,
    SettingsModule,
    LocationsModule,
    SetupModule,
    GoodsReceivedModule,
    MacrosModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class AppModule {}
