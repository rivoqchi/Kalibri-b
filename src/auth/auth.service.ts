import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomInt } from 'node:crypto';
import { AuthCode, AuthCodeDocument } from './auth-code.schema.js';
import { JwtTokenService } from './jwt-token.service.js';
import { UsersService } from '../users/users.service.js';
import { normalizePhone, phonesMatch } from '../common/utils/phone.js';
import type { UserRole } from '../users/user.schema.js';

export type CreateAuthCodeInput = {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(AuthCode.name)
    private readonly authCodeModel: Model<AuthCode>,
    private readonly usersService: UsersService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly config: ConfigService,
  ) {}

  resolveRole(phone?: string | null): UserRole {
    const adminPhone = this.config.get<string>('adminPhone') ?? '+998947932005';
    return phonesMatch(phone, adminPhone) ? 'admin' : 'user';
  }

  async createLoginCode(input: CreateAuthCodeInput): Promise<string> {
    const ttlSeconds = this.config.get<number>('authCodeTtlSeconds') ?? 300;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const existing = await this.usersService.findByTelegramId(input.telegramId);
    const phone =
      normalizePhone(input.phone) ??
      normalizePhone(existing?.phone) ??
      undefined;

    if (!phone) {
      throw new BadRequestException('Telefon');
    }

    await this.authCodeModel.updateMany(
      { telegramId: input.telegramId, used: false },
      { $set: { used: true } },
    );

    let code = '';
    for (let attempt = 0; attempt < 12; attempt += 1) {
      code = String(randomInt(1000, 10000));
      try {
        await this.authCodeModel.create({
          code,
          telegramId: input.telegramId,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName ?? '',
          phone,
          expiresAt,
          used: false,
        });
        return code;
      } catch {
        // unique collision — retry
      }
    }

    throw new BadRequestException('Kod');
  }

  async verifyTelegramCode(code: string) {
    const record = (await this.authCodeModel
      .findOne({ code, used: false })
      .exec()) as AuthCodeDocument | null;

    if (!record) {
      throw new UnauthorizedException('Kod');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      record.used = true;
      await record.save();
      throw new UnauthorizedException('Kod');
    }

    record.used = true;
    await record.save();

    const existing = await this.usersService.findByTelegramId(record.telegramId);
    const phone =
      normalizePhone(record.phone) ??
      normalizePhone(existing?.phone) ??
      null;
    const roleFromPhone = this.resolveRole(phone);
    const role: UserRole =
      roleFromPhone === 'admin' || existing?.role === 'admin' ? 'admin' : 'user';

    const user = await this.usersService.upsertFromTelegram({
      telegramId: record.telegramId,
      username: record.username,
      firstName: record.firstName,
      lastName: record.lastName,
      phone,
      role,
    });

    const token = await this.jwtTokenService.sign({
      sub: String(user._id),
      role: user.role,
      telegramId: user.telegramId,
    });

    return {
      token,
      user: this.usersService.toPublic(user),
    };
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Profil');
    }
    return this.usersService.toPublic(user);
  }
}
