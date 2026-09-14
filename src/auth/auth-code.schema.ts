import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuthCodeDocument = HydratedDocument<AuthCode>;

@Schema({ timestamps: true, collection: 'auth_codes' })
export class AuthCode {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({ required: true, index: true })
  telegramId!: number;

  @Prop({ trim: true })
  username?: string;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ trim: true, default: '' })
  lastName!: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  used!: boolean;
}

export const AuthCodeSchema = SchemaFactory.createForClass(AuthCode);
AuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
