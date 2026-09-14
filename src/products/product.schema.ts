import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ _id: false })
export class MoneyEmbedded {
  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, default: 'UZS' })
  currency!: string;
}

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true })
  slug!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: MoneyEmbedded, required: true })
  price!: MoneyEmbedded;

  @Prop({ trim: true })
  imageUrl?: string;

  @Prop({ type: [String], default: [] })
  imageUrls!: string[];

  @Prop({ type: Types.ObjectId, ref: 'Category', index: true })
  categoryId?: Types.ObjectId;

  @Prop({ trim: true, index: true })
  categorySlug?: string;

  @Prop({ trim: true, index: true })
  brand?: string;

  @Prop({ trim: true, index: true })
  modelName?: string;

  @Prop({ default: true, index: true })
  inStock!: boolean;

  @Prop({ default: 0, min: 0 })
  stockQty!: number;

  @Prop({ default: 0, index: true })
  soldCount!: number;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ default: false, index: true })
  isNewArrival!: boolean;

  /** Free-text tokens for Uzbek/Russian search intents */
  @Prop({ type: [String], default: [], index: true })
  searchTags!: string[];

  @Prop({ trim: true })
  seoTitle?: string;

  @Prop({ trim: true })
  seoDescription?: string;

  @Prop({ type: [String], default: [] })
  seoKeywords!: string[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
  modelName: 'text',
  searchTags: 'text',
  seoKeywords: 'text',
});

ProductSchema.index({ 'price.amount': 1, categorySlug: 1, inStock: 1 });
ProductSchema.index({ brand: 1, modelName: 1, isNewArrival: -1 });
ProductSchema.index({ soldCount: -1 });
ProductSchema.index({ updatedAt: -1 });
