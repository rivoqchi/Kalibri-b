import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AttributeDocument = HydratedDocument<Attribute>;

@Schema({ timestamps: true, collection: 'attributes' })
export class Attribute {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  value!: string;

  @Prop({ default: '', trim: true })
  unit!: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true })
  slug!: string;

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const AttributeSchema = SchemaFactory.createForClass(Attribute);
AttributeSchema.index({ name: 1, value: 1, unit: 1 }, { unique: true });
