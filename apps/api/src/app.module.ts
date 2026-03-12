import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DrizzleModule } from './drizzle/drizzle.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GstModule } from './gst/gst.module';
import { MetricsInterceptor } from './common/metrics.interceptor';

@Module({
  imports: [
    DrizzleModule,
    AuthModule,
    AccountsModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    DashboardModule,
    GstModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule {}
