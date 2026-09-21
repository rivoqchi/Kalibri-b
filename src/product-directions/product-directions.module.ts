import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProductDirection,
  ProductDirectionSchema,
} from './product-direction.schema.js';
import { ProductDirectionsService } from './product-directions.service.js';
import { ProductDirectionsController } from './product-directions.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductDirection.name, schema: ProductDirectionSchema },
    ]),
    AuthModule,
  ],
  controllers: [ProductDirectionsController],
  providers: [ProductDirectionsService],
  exports: [ProductDirectionsService],
})
export class ProductDirectionsModule {}
