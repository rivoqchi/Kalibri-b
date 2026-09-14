import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export type UserRole = 'user' | 'admin';

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

  @Prop({ required: true, enum: ['user', 'admin'], default: 'user', index: true })
  role!: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);
