import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HomeAdDocument = HydratedDocument<HomeAd>;

@Schema({ timestamps: true, collection: 'home_ads' })
export class HomeAd {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  imageUrl!: string;

  @Prop({ required: true, trim: true })
  link!: string;

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const HomeAdSchema = SchemaFactory.createForClass(HomeAd);
HomeAdSchema.index({ name: 'text' });
