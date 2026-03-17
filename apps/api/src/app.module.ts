import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { DrizzleModule } from './drizzle/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GstModule } from './gst/gst.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { MetricsInterceptor } from './common/metrics.interceptor';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ReceptionsModule } from './receptions/receptions.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    DrizzleModule,
    AuthModule,
    AccountsModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    DashboardModule,
    GstModule,
    TelemetryModule,
    SuppliersModule,
    PurchaseOrdersModule,
    ReceptionsModule,
    ReportsModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class AppModule {}
