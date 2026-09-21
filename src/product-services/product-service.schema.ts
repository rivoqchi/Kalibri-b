import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductServiceDocument = HydratedDocument<ProductService>;

@Schema({ timestamps: true, collection: 'product_services' })
export class ProductService {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  imageUrl!: string;

  @Prop({ trim: true, default: '' })
  phone!: string;

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const ProductServiceSchema = SchemaFactory.createForClass(ProductService);
ProductServiceSchema.index({ name: 'text' });
