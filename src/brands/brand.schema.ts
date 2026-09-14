import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BrandDocument = HydratedDocument<Brand>;

@Schema({ timestamps: true, collection: 'brands' })
export class Brand {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  imageUrl!: string;

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);
BrandSchema.index({ name: 'text' });
