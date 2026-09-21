import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ required: true, trim: true })
  message!: string;

  @Prop({ required: true, index: true })
  orderId!: string;

  @Prop({ required: true, default: 'admin', index: true })
  audience!: string;

  @Prop({ default: false, index: true })
  read!: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ audience: 1, createdAt: -1 });
