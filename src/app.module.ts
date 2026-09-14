import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration.js';
import { resolveMongoUri } from './database/mongo-uri.js';
import { CacheModule } from './cache/cache.module.js';
import { ProductsModule } from './products/products.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { BrandsModule } from './brands/brands.module.js';
import { AttributesModule } from './attributes/attributes.module.js';
import { CartModule } from './cart/cart.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { SeoModule } from './seo/seo.module.js';
import { MediaModule } from './media/media.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { HealthModule } from './health/health.module.js';
import { SeedModule } from './seed/seed.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const configured = config.getOrThrow<string>('mongodbUri');
        const { uri, mode } = await resolveMongoUri(configured);
        return {
          uri,
          maxPoolSize: mode === 'memory' ? 10 : 50,
          minPoolSize: mode === 'memory' ? 1 : 5,
          serverSelectionTimeoutMS: 5000,
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
    CartModule,
    CheckoutModule,
    SeoModule,
    MediaModule,
    HealthModule,
    SeedModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
