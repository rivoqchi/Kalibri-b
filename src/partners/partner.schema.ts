import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PartnerDocument = HydratedDocument<Partner>;

@Schema({ _id: false })
export class PartnerMonth {
  @Prop({ required: true, min: 1 })
  month!: number;

  @Prop({ required: true, min: 0 })
  percent!: number;
}

@Schema({ timestamps: true, collection: 'partners' })
export class Partner {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  imageUrl!: string;

  @Prop({ trim: true, default: '' })
  phone!: string;

  @Prop({ type: [PartnerMonth], default: [] })
  months!: PartnerMonth[];

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const PartnerSchema = SchemaFactory.createForClass(Partner);
PartnerSchema.index({ name: 'text' });
