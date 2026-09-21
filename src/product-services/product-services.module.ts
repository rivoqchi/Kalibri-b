import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProductService,
  ProductServiceSchema,
} from './product-service.schema.js';
import { ProductServicesService } from './product-services.service.js';
import { ProductServicesController } from './product-services.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductService.name, schema: ProductServiceSchema },
    ]),
    AuthModule,
  ],
  controllers: [ProductServicesController],
  providers: [ProductServicesService],
  exports: [ProductServicesService],
})
export class ProductServicesModule {}
