import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Favorites, FavoritesSchema } from './favorites.schema.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import { FavoritesService } from './favorites.service.js';
import { FavoritesController } from './favorites.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Favorites.name, schema: FavoritesSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    AuthModule,
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
