import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true })
  slug!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  imageUrl?: string;

  @Prop({ default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  parentId?: Types.ObjectId | null;

  /** SEO fields served to Next.js metadata */
  @Prop({ trim: true })
  seoTitle?: string;

  @Prop({ trim: true })
  seoDescription?: string;

  @Prop({ type: [String], default: [] })
  seoKeywords!: string[];
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ name: 'text', description: 'text', seoKeywords: 'text' });
