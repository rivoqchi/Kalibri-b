import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { USER_ROLES, type UserRole } from './user-role.js';

export type { UserRole };
export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, index: true })
  telegramId!: number;

  @Prop({ trim: true })
  username?: string;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ trim: true, default: '' })
  lastName!: string;

  @Prop({ trim: true, index: true })
  phone?: string;

  @Prop({ required: true, enum: USER_ROLES, default: 'user', index: true })
  role!: UserRole;

  @Prop({ trim: true })
  photoUrl?: string;

  @Prop({ trim: true })
  telegramPhotoFileId?: string;

  @Prop({ default: false })
  photoCustom?: boolean;

  @Prop({ type: Buffer, select: false })
  photoBuffer?: Buffer;

  @Prop({ trim: true, select: false })
  photoContentType?: string;

  @Prop({ default: false, index: true })
  isBlocked!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
