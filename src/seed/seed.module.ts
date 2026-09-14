import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from '../categories/category.schema.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
