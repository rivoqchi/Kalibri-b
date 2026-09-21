import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './product.schema.js';
import { Category, CategorySchema } from '../categories/category.schema.js';
import { Attribute, AttributeSchema } from '../attributes/attribute.schema.js';
import {
  ProductDirection,
  ProductDirectionSchema,
} from '../product-directions/product-direction.schema.js';
import { ProductsService } from './products.service.js';
import { ProductsController } from './products.controller.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Attribute.name, schema: AttributeSchema },
      { name: ProductDirection.name, schema: ProductDirectionSchema },
    ]),
    forwardRef(() => RealtimeModule),
    AuthModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
