import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './product.schema.js';
import { Category, CategorySchema } from '../categories/category.schema.js';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
