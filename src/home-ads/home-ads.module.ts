import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeAd, HomeAdSchema } from './home-ad.schema.js';
import { HomeAdsService } from './home-ads.service.js';
import { HomeAdsController } from './home-ads.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HomeAd.name, schema: HomeAdSchema }]),
    AuthModule,
  ],
  controllers: [HomeAdsController],
  providers: [HomeAdsService],
  exports: [HomeAdsService],
})
export class HomeAdsModule {}
