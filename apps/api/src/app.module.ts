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
import { GstModule } from './gst/gst.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { MetricsInterceptor } from './common/metrics.interceptor';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ReceptionsModule } from './receptions/receptions.module';
import { ReportsModule } from './reports/reports.module';
import { InvoicesModule } from './invoices/invoices.module';
import { GlModule } from './gl/gl.module';
import { SystemModule } from './system/system.module';

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
    GstModule,
    TelemetryModule,
    SuppliersModule,
    PurchaseOrdersModule,
    ReceptionsModule,
    ReportsModule,
    GlModule,
    SystemModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class AppModule {}
