import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeoTemplate, SeoTemplateSchema } from './seo-template.schema.js';
import { Product, ProductSchema } from '../products/product.schema.js';
import { Category, CategorySchema } from '../categories/category.schema.js';
import { SeoService } from './seo.service.js';
import { SeoController } from './seo.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SeoTemplate.name, schema: SeoTemplateSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
