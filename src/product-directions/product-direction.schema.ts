import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDirectionDocument = HydratedDocument<ProductDirection>;

@Schema({ timestamps: true, collection: 'product_directions' })
export class ProductDirection {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  imageUrl!: string;

  @Prop({ type: [Types.ObjectId], ref: 'Product', default: [], index: true })
  productIds!: Types.ObjectId[];

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const ProductDirectionSchema =
  SchemaFactory.createForClass(ProductDirection);
ProductDirectionSchema.index({ name: 'text' });
