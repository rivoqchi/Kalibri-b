import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Attribute, AttributeSchema } from './attribute.schema.js';
import { AttributesService } from './attributes.service.js';
import { AttributesController } from './attributes.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attribute.name, schema: AttributeSchema },
    ]),
    AuthModule,
  ],
  controllers: [AttributesController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}
