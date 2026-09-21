import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration.js';
import { resolveMongoUri } from './database/mongo-uri.js';
import { CacheModule } from './cache/cache.module.js';
import { ProductsModule } from './products/products.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { BrandsModule } from './brands/brands.module.js';
import { AttributesModule } from './attributes/attributes.module.js';
import { PartnersModule } from './partners/partners.module.js';
import { ProductServicesModule } from './product-services/product-services.module.js';
import { ProductDirectionsModule } from './product-directions/product-directions.module.js';
import { HomeAdsModule } from './home-ads/home-ads.module.js';
import { CartModule } from './cart/cart.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { SearchModule } from './search/search.module.js';

import { CheckoutModule } from './checkout/checkout.module.js';
import { SeoModule } from './seo/seo.module.js';
import { MediaModule } from './media/media.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { HealthModule } from './health/health.module.js';
import { PingModule } from './ping/ping.module.js';
import { SeedModule } from './seed/seed.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AdminModule } from './admin/admin.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const configured = config.getOrThrow<string>('mongodbUri');
        const { uri, mode } = await resolveMongoUri(configured);
        // #region agent log
        console.log(
          '[boot]',
          JSON.stringify({
            hypothesisId: 'H15',
            message: 'mongoose connect options',
            mode,
            family: 4,
            lazyConnection: true,
            serverSelectionTimeoutMS: 15_000,
          }),
        );
        // #endregion
        return {
          uri,
          maxPoolSize: mode === 'memory' ? 10 : 50,
          minPoolSize: mode === 'memory' ? 1 : 5,
          // Render/Node 17+ may prefer IPv6; Atlas TLS often needs IPv4.
          family: 4,
          autoSelectFamily: false,
          serverSelectionTimeoutMS: 15_000,
          // Do not block Nest listen on Atlas TLS — health can report mongo down.
          lazyConnection: true,
          connectionFactory: (connection: {
            on: (event: string, cb: (...args: unknown[]) => void) => void;
            readyState: number;
          }) => {
            connection.on('connected', () => {
              console.log(
                '[boot]',
                JSON.stringify({
                  hypothesisId: 'H15',
                  mongo: 'connected',
                  readyState: connection.readyState,
                }),
              );
            });
            connection.on('error', (err: unknown) => {
              const message =
                err instanceof Error ? err.message : String(err);
              const isTls = /SSL|TLS|whitelist|IP|ServerSelection/i.test(
                message,
              );
              console.error(
                '[boot]',
                JSON.stringify({
                  hypothesisId: isTls ? 'H9' : 'H15',
                  mongo: 'error',
                  message,
                  hint: isTls
                    ? 'Atlas Network Access must allow 0.0.0.0/0'
                    : undefined,
                }),
              );
            });
            return connection;
          },
          autoIndex: true,
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    CacheModule,
    RealtimeModule,
    ProductsModule,
    CategoriesModule,
    BrandsModule,
    AttributesModule,
    PartnersModule,
    ProductServicesModule,
    ProductDirectionsModule,
    HomeAdsModule,
    CartModule,
    FavoritesModule,
    SearchModule,
    CheckoutModule,
    SeoModule,
    MediaModule,
    HealthModule,
    PingModule,
    SeedModule,
    UsersModule,
    AuthModule,
    AdminModule,
    NotificationsModule,
    OrdersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
