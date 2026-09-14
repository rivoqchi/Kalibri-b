import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SeoTemplateDocument = HydratedDocument<SeoTemplate>;

export enum SeoIntent {
  NEWEST = 'newest',
  CHEAPEST = 'cheapest',
  BESTSELLER = 'bestseller',
  BRAND_MODEL = 'brand_model',
  CATEGORY = 'category',
  COMPARISON = 'comparison',
  GENERIC_SEARCH = 'generic_search',
}

@Schema({ timestamps: true, collection: 'seo_templates' })
export class SeoTemplate {
  @Prop({ required: true, unique: true, index: true })
  key!: string;

  @Prop({ required: true, enum: SeoIntent, index: true })
  intent!: SeoIntent;

  @Prop({ required: true })
  titleTemplate!: string;

  @Prop({ required: true })
  descriptionTemplate!: string;

  @Prop({ required: true })
  h1Template!: string;

  @Prop({ type: [String], default: [] })
  keywordTemplates!: string[];

  /** Example queries this template matches (for docs + matching) */
  @Prop({ type: [String], default: [] })
  exampleQueries!: string[];

  @Prop({ type: [String], default: [] })
  matchPatterns!: string[];

  @Prop({ default: true })
  isActive!: boolean;
}

export const SeoTemplateSchema = SchemaFactory.createForClass(SeoTemplate);
