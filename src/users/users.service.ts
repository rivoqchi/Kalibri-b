import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './user.schema.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

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

  async findAllWithPhoneAdmin() {
    const docs = await this.userModel
      .find({ phone: { $exists: true, $nin: [null, ''] } })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((doc) => this.toAdmin(doc));
  }

  async updateAdmin(id: string, dto: UpdateUserDto) {
    const doc = await this.userModel.findById(id).exec();
    if (!doc) throw new NotFoundException('User');
    if (dto.isBlocked !== undefined) {
      doc.isBlocked = dto.isBlocked;
    }
    await doc.save();
    return this.toAdmin(doc);
  }

  toAdmin(user: UserDocument) {
    const publicUser = this.toPublic(user);
    return {
      ...publicUser,
      isBlocked: Boolean(user.isBlocked),
    };
  }

  async upsertFromTelegram(input: UpsertTelegramUserInput): Promise<UserDocument> {
    const $set: Partial<User> = {
      telegramId: input.telegramId,
      username: input.username,
      role: input.role,
    };
    if (input.phone) {
      $set.phone = input.phone;
    }

    return this.userModel
      .findOneAndUpdate(
        { telegramId: input.telegramId },
        {
          $set,
          $setOnInsert: {
            firstName: input.firstName,
            lastName: input.lastName ?? '',
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec() as Promise<UserDocument>;
  }

  async updateRole(id: string, role: UserRole): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, { $set: { role } }, { returnDocument: 'after' })
      .exec();
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).exec();
  }

  async updateNames(
    id: string,
    firstName: string,
    lastName: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { firstName, lastName } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async updatePhoto(
    id: string,
    photo: { telegramPhotoFileId: string; photoUrl?: string },
  ): Promise<UserDocument | null> {
    const existing = await this.userModel.findById(id).exec();
    if (!existing || existing.photoCustom) return existing;
    const $set: Partial<User> = {
      telegramPhotoFileId: photo.telegramPhotoFileId,
    };
    if (photo.photoUrl) {
      $set.photoUrl = photo.photoUrl;
    }
    return this.userModel
      .findByIdAndUpdate(id, { $set }, { returnDocument: 'after' })
      .exec();
  }

  async setCustomPhoto(
    id: string,
    photo: {
      photoUrl?: string;
      photoBuffer?: Buffer;
      photoContentType?: string;
    },
  ): Promise<UserDocument | null> {
    const $set: Partial<User> = { photoCustom: true };
    const $unset: Record<string, 1> = {};
    if (photo.photoUrl) {
      $set.photoUrl = photo.photoUrl;
      $unset.photoBuffer = 1;
      $unset.photoContentType = 1;
    } else if (photo.photoBuffer) {
      $set.photoBuffer = photo.photoBuffer;
      $set.photoContentType = photo.photoContentType || 'image/jpeg';
      $unset.photoUrl = 1;
    }
    return this.userModel
      .findByIdAndUpdate(
        id,
        Object.keys($unset).length ? { $set, $unset } : { $set },
        { returnDocument: 'after' },
      )
      .exec();
  }

  async findByIdWithPhoto(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findById(id)
      .select('+photoBuffer +photoContentType')
      .exec();
  }

  toPublic(user: UserDocument) {
    const updatedAt = user.get('updatedAt') as Date | undefined;
    return {
      id: String(user._id),
      telegramId: user.telegramId,
      username: user.username ?? null,
      firstName: user.firstName,
      lastName: user.lastName ?? '',
      phone: user.phone ?? null,
      role: user.role,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ').trim(),
      photoUrl: user.photoUrl ?? null,
      photoCustom: Boolean(user.photoCustom),
      photoRevision: updatedAt ? new Date(updatedAt).getTime() : 0,
      isBlocked: Boolean(user.isBlocked),
    };
  }
}
