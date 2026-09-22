import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { AuthCode, AuthCodeDocument } from './auth-code.schema.js';
import { JwtTokenService, type JwtPayload } from './jwt-token.service.js';
import { UsersService } from '../users/users.service.js';
import { TelegramPhotoService } from './telegram-photo.service.js';
import { MediaService } from '../media/media.service.js';
import { assertFolderImageDimensions } from '../media/image-dimensions.js';
import { normalizePhone, phonesMatch } from '../common/utils/phone.js';
import type { UserRole } from '../users/user.schema.js';
import { isAdminRole, isSuperAdminRole } from '../users/user-role.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

type TelegramWebAppUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

/** Reject Mini App initData older than 24 hours */
const WEBAPP_AUTH_MAX_AGE_SECONDS = 86_400;

export type CreateAuthCodeInput = {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
};

export type CreateLoginCodeResult =
  | { ok: true; code: string }
  | { ok: false; cooldownSeconds: number };

/** Minimum gap between issuing new login codes */
const LOGIN_CODE_COOLDOWN_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(AuthCode.name)
    private readonly authCodeModel: Model<AuthCode>,
    private readonly usersService: UsersService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly config: ConfigService,
    private readonly telegramPhoto: TelegramPhotoService,
    @Inject(forwardRef(() => MediaService))
    private readonly mediaService: MediaService,
  ) {}

  resolveRole(phone?: string | null): UserRole {
    const superAdminPhone =
      this.config.get<string>('superAdminPhone') ?? '+998947932005';
    if (phonesMatch(phone, superAdminPhone)) {
      return 'super_admin';
    }
    const adminPhone = this.config.get<string>('adminPhone') ?? '+998947932005';
    if (phonesMatch(phone, adminPhone)) {
      return 'admin';
    }
    return 'user';
  }

  private persistRole(phone: string | null, existingRole?: UserRole): UserRole {
    const fromPhone = this.resolveRole(phone);
    if (fromPhone === 'super_admin') return 'super_admin';
    if (fromPhone === 'admin' || existingRole === 'admin') return 'admin';
    return 'user';
  }

  private assertNotBlocked(user: { isBlocked?: boolean } | null | undefined) {
    if (user?.isBlocked) {
      throw new ForbiddenException('Blok');
    }
  }

  async createLoginCode(input: CreateAuthCodeInput): Promise<CreateLoginCodeResult> {
    const ttlSeconds = Math.max(
      this.config.get<number>('authCodeTtlSeconds') ?? 300,
      Math.ceil(LOGIN_CODE_COOLDOWN_MS / 1000),
    );
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const existing = await this.usersService.findByTelegramId(input.telegramId);
    this.assertNotBlocked(existing);
    const phone =
      normalizePhone(input.phone) ??
      normalizePhone(existing?.phone) ??
      undefined;

    if (!phone) {
      throw new BadRequestException('Telefon');
    }

    const latest = await this.authCodeModel
      .findOne({ telegramId: input.telegramId })
      .sort({ createdAt: -1 })
      .exec();
    const latestCreatedAt = latest?.get('createdAt') as Date | undefined;
    if (latestCreatedAt) {
      const elapsed = Date.now() - new Date(latestCreatedAt).getTime();
      if (elapsed < LOGIN_CODE_COOLDOWN_MS) {
        const cooldownSeconds = Math.ceil(
          (LOGIN_CODE_COOLDOWN_MS - elapsed) / 1000,
        );
        return { ok: false, cooldownSeconds };
      }
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
        return { ok: true, code };
      } catch {
        // unique collision — retry
      }
    }

    throw new BadRequestException('Kod');
  }

  async issueSessionForTelegramId(telegramId: number) {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new BadRequestException('User');
    }
    return this.issueSession(user);
  }

  /**
   * Upsert user from Telegram identity. Phone is optional (shop / Mini App).
   * Preserves existing phone and role via persistRole.
   */
  async ensureUserFromTelegram(input: {
    telegramId: number;
    username?: string;
    firstName: string;
    lastName?: string;
  }) {
    const existing = await this.usersService.findByTelegramId(input.telegramId);
    this.assertNotBlocked(existing);
    const phone = normalizePhone(existing?.phone) ?? null;
    const role = this.persistRole(phone, existing?.role);
    const user = await this.usersService.upsertFromTelegram({
      telegramId: input.telegramId,
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName ?? '',
      phone,
      role,
    });
    return {
      id: String(user._id),
      phone: user.phone ?? null,
    };
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
    this.assertNotBlocked(existing);
    const phone =
      normalizePhone(record.phone) ??
      normalizePhone(existing?.phone) ??
      null;
    const role = this.persistRole(phone, existing?.role);

    const user = await this.usersService.upsertFromTelegram({
      telegramId: record.telegramId,
      username: record.username,
      firstName: record.firstName,
      lastName: record.lastName,
      phone,
      role,
    });

    return this.issueSession(user);
  }

  /**
   * Validate Telegram Mini App initData (HMAC) and issue a JWT session.
   * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   */
  async verifyTelegramWebApp(initData: string) {
    const botToken = this.config.get<string>('telegramBotToken')?.trim();
    if (!botToken) {
      throw new BadRequestException('Telegram bot sozlanmagan.');
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      throw new UnauthorizedException('initData');
    }
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    const calculated = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const hashBuf = Buffer.from(hash, 'hex');
    const calcBuf = Buffer.from(calculated, 'hex');
    if (
      hashBuf.length !== calcBuf.length ||
      !timingSafeEqual(hashBuf, calcBuf)
    ) {
      throw new UnauthorizedException('initData');
    }

    const authDate = Number(params.get('auth_date'));
    if (
      !Number.isFinite(authDate) ||
      Math.abs(Date.now() / 1000 - authDate) > WEBAPP_AUTH_MAX_AGE_SECONDS
    ) {
      throw new UnauthorizedException('initData');
    }

    const userRaw = params.get('user');
    if (!userRaw) {
      throw new UnauthorizedException('initData');
    }

    let tgUser: TelegramWebAppUser;
    try {
      tgUser = JSON.parse(userRaw) as TelegramWebAppUser;
    } catch {
      throw new UnauthorizedException('initData');
    }

    if (!tgUser?.id || !tgUser.first_name) {
      throw new UnauthorizedException('initData');
    }

    const existing = await this.usersService.findByTelegramId(tgUser.id);
    this.assertNotBlocked(existing);
    const phone = normalizePhone(existing?.phone) ?? null;
    const role = this.persistRole(phone, existing?.role);

    const user = await this.usersService.upsertFromTelegram({
      telegramId: tgUser.id,
      username: tgUser.username,
      firstName: tgUser.first_name,
      lastName: tgUser.last_name ?? '',
      phone,
      role,
    });

    return this.issueSession(user);
  }

  private async issueSession(
    user: Awaited<ReturnType<UsersService['upsertFromTelegram']>>,
  ) {
    this.assertNotBlocked(user);
    this.telegramPhoto.scheduleSync(user.telegramId);
    const fresh =
      (await this.usersService.findById(String(user._id))) ?? user;
    this.assertNotBlocked(fresh);
    const token = await this.jwtTokenService.sign({
      sub: String(fresh._id),
      role: fresh.role,
      telegramId: fresh.telegramId,
    });

    return {
      token,
      user: this.usersService.toPublic(fresh),
    };
  }

  async ensureSuperAdmin(payload: JwtPayload): Promise<boolean> {
    const user = await this.resolveUser(payload);
    const expected = this.persistRole(user.phone ?? null, user.role);
    if (expected !== user.role) {
      await this.usersService.updateRole(String(user._id), expected);
    }
    return isSuperAdminRole(expected);
  }

  async getMe(payload: JwtPayload) {
    let user = await this.resolveUser(payload);
    const expected = this.persistRole(user.phone ?? null, user.role);
    if (expected !== user.role) {
      user =
        (await this.usersService.updateRole(String(user._id), expected)) ??
        user;
    }
    if (!user.photoCustom) {
      this.telegramPhoto.scheduleSync(user.telegramId);
    }
    const fresh =
      (await this.usersService.findById(String(user._id))) ?? user;
    return this.usersService.toPublic(fresh);
  }

  async updateMe(payload: JwtPayload, dto: UpdateProfileDto) {
    const user = await this.resolveUser(payload);
    const updated = await this.usersService.updateNames(
      String(user._id),
      dto.firstName,
      dto.lastName,
    );
    if (!updated) {
      throw new UnauthorizedException('Token');
    }
    return this.usersService.toPublic(updated);
  }

  async updateMePhoto(
    payload: JwtPayload,
    file: { buffer?: Buffer; mimetype?: string; size?: number },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Rasm');
    }
    const mime = file.mimetype || 'image/jpeg';
    if (!mime.startsWith('image/')) {
      throw new BadRequestException('Rasm');
    }
    if ((file.size ?? file.buffer.length) > 8 * 1024 * 1024) {
      throw new BadRequestException('Rasm');
    }
    try {
      assertFolderImageDimensions('avatars', file.buffer);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Rasm',
      );
    }

    const user = await this.resolveUser(payload);
    let photoUrl: string | undefined;
    if (this.mediaService.isConfigured()) {
      const uploaded = await this.mediaService.uploadObject(
        file.buffer,
        mime,
        'avatars',
      );
      photoUrl = uploaded.publicUrl;
    }

    const updated = await this.usersService.setCustomPhoto(String(user._id), {
      photoUrl,
      photoBuffer: photoUrl ? undefined : file.buffer,
      photoContentType: mime,
    });
    if (!updated) {
      throw new UnauthorizedException('Token');
    }
    return this.usersService.toPublic(updated);
  }

  async getMePhoto(payload: JwtPayload) {
    const user = await this.resolveUser(payload);

    if (user.photoUrl) {
      try {
        const response = await fetch(user.photoUrl, {
          signal: AbortSignal.timeout(2_500),
        });
        if (response.ok) {
          return {
            buffer: Buffer.from(await response.arrayBuffer()),
            contentType: response.headers.get('content-type') || 'image/jpeg',
          };
        }
      } catch {
        /* fall through */
      }
    }

    if (user.photoCustom) {
      const withPhoto = await this.usersService.findByIdWithPhoto(
        String(user._id),
      );
      if (withPhoto?.photoBuffer?.length) {
        return {
          buffer: withPhoto.photoBuffer,
          contentType: withPhoto.photoContentType || 'image/jpeg',
        };
      }
    }

    const photo = await this.telegramPhoto.downloadProfilePhoto(user.telegramId);
    if (!photo) {
      throw new NotFoundException('Rasm');
    }
    return photo;
  }

  private async resolveUser(payload: JwtPayload) {
    let user = await this.usersService.findById(payload.sub);
    if (!user) {
      user = await this.usersService.findByTelegramId(payload.telegramId);
    }
    if (!user) {
      const superAdminPhone =
        this.config.get<string>('superAdminPhone') ?? '+998947932005';
      const adminPhone = this.config.get<string>('adminPhone') ?? null;
      const phone =
        payload.role === 'super_admin'
          ? superAdminPhone
          : payload.role === 'admin'
            ? adminPhone
            : null;
      user = await this.usersService.upsertFromTelegram({
        telegramId: payload.telegramId,
        firstName: isAdminRole(payload.role) ? 'Admin' : 'User',
        phone,
        role: payload.role,
      });
    }
    this.assertNotBlocked(user);
    return user;
  }
}
