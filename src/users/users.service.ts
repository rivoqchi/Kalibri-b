import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './user.schema.js';

export type UpsertTelegramUserInput = {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
  role: UserRole;
};

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByTelegramId(telegramId: number): Promise<UserDocument | null> {
    return this.userModel.findOne({ telegramId }).exec();
  }

  async upsertFromTelegram(input: UpsertTelegramUserInput): Promise<UserDocument> {
    const update: Partial<User> = {
      telegramId: input.telegramId,
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName ?? '',
      role: input.role,
    };
    if (input.phone) {
      update.phone = input.phone;
    }

    return this.userModel
      .findOneAndUpdate(
        { telegramId: input.telegramId },
        { $set: update },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec() as Promise<UserDocument>;
  }

  toPublic(user: UserDocument) {
    return {
      id: String(user._id),
      telegramId: user.telegramId,
      username: user.username ?? null,
      firstName: user.firstName,
      lastName: user.lastName ?? '',
      phone: user.phone ?? null,
      role: user.role,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim(),
    };
  }
}
