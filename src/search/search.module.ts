import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { ProductsModule } from '../products/products.module.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import {
  SearchHistory,
  SearchHistorySchema,
} from './search-history.schema.js';
import {
  SearchRecentProduct,
  SearchRecentProductSchema,
} from './search-recent-product.schema.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SearchHistory.name, schema: SearchHistorySchema },
      { name: SearchRecentProduct.name, schema: SearchRecentProductSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    ProductsModule,
    AuthModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
