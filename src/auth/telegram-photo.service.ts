import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { UsersService } from '../users/users.service.js';
import { MediaService } from '../media/media.service.js';

const TELEGRAM_API_TIMEOUT_MS = 2_500;
const SYNC_FAIL_COOLDOWN_MS = 10 * 60 * 1_000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Timed-out races must not leave unhandled rejections.
  promise.catch(() => undefined);
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label}_timeout_${ms}`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class TelegramPhotoService {
  private readonly logger = new Logger(TelegramPhotoService.name);
  private bot: Bot | null = null;
  private readonly inflight = new Map<number, Promise<void>>();
  private readonly failUntil = new Map<number, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => MediaService))
    private readonly mediaService: MediaService,
  ) {}

  attachBot(bot: Bot | null) {
    this.bot = bot;
  }

  /** Non-blocking: never awaits Telegram on the request path. */
  scheduleSync(telegramId: number): void {
    void this.syncProfilePhoto(telegramId);
  }

  private isCoolingDown(telegramId: number): boolean {
    const until = this.failUntil.get(telegramId);
    return Boolean(until && until > Date.now());
  }

  private markFailed(telegramId: number): void {
    this.failUntil.set(telegramId, Date.now() + SYNC_FAIL_COOLDOWN_MS);
  }

  async syncProfilePhoto(telegramId: number): Promise<void> {
    if (!this.bot) return;
    if (this.isCoolingDown(telegramId)) return;

    const existingInflight = this.inflight.get(telegramId);
    if (existingInflight) return existingInflight;

    const run = this.runSync(telegramId).finally(() => {
      this.inflight.delete(telegramId);
    });
    this.inflight.set(telegramId, run);
    return run;
  }

  private async runSync(telegramId: number): Promise<void> {
    if (!this.bot) return;

    try {
      const photos = await withTimeout(
        this.bot.api.getUserProfilePhotos(telegramId, { limit: 1 }),
        TELEGRAM_API_TIMEOUT_MS,
        'getUserProfilePhotos',
      );
      const sizes = photos.photos[0];
      if (!sizes?.length) {
        this.failUntil.delete(telegramId);
        return;
      }

      const best = sizes.reduce((a, b) =>
        (a.file_size ?? 0) >= (b.file_size ?? 0) ? a : b,
      );
      const existing = await this.usersService.findByTelegramId(telegramId);
      if (!existing || existing.photoCustom) {
        this.failUntil.delete(telegramId);
        return;
      }
      if (
        existing.telegramPhotoFileId === best.file_id &&
        (existing.photoUrl || !this.mediaService.isConfigured())
      ) {
        this.failUntil.delete(telegramId);
        return;
      }

      let photoUrl: string | undefined;
      if (this.mediaService.isConfigured()) {
        const token = this.config.get<string>('telegramBotToken')?.trim();
        const file = token
          ? await withTimeout(
              this.bot.api.getFile(best.file_id),
              TELEGRAM_API_TIMEOUT_MS,
              'getFile',
            )
          : null;
        if (token && file?.file_path) {
          const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
          const response = await withTimeout(
            fetch(fileUrl),
            TELEGRAM_API_TIMEOUT_MS,
            'fetchFile',
          );
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const contentType =
              response.headers.get('content-type') || 'image/jpeg';
            try {
              const uploaded = await this.mediaService.uploadObject(
                buffer,
                contentType.startsWith('image/') ? contentType : 'image/jpeg',
                'avatars',
              );
              photoUrl = uploaded.publicUrl;
            } catch {
              this.logger.warn('Avatar R2 upload failed');
            }
          }
        }
      }

      await this.usersService.updatePhoto(String(existing._id), {
        telegramPhotoFileId: best.file_id,
        photoUrl,
      });
      this.failUntil.delete(telegramId);
    } catch {
      this.markFailed(telegramId);
      this.logger.warn(
        `Profile photo sync failed telegramId=${telegramId}`,
      );
    }
  }

  async downloadProfilePhoto(
    telegramId: number,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);

      if (user?.photoUrl) {
        const response = await withTimeout(
          fetch(user.photoUrl),
          TELEGRAM_API_TIMEOUT_MS,
          'fetchCachedPhoto',
        );
        if (response.ok) {
          return {
            buffer: Buffer.from(await response.arrayBuffer()),
            contentType: response.headers.get('content-type') || 'image/jpeg',
          };
        }
      }

      if (user?.photoCustom) {
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

      if (!this.bot || this.isCoolingDown(telegramId)) {
        return null;
      }

      const fileId = user?.telegramPhotoFileId;
      if (!fileId) {
        this.scheduleSync(telegramId);
        return null;
      }

      const file = await withTimeout(
        this.bot.api.getFile(fileId),
        TELEGRAM_API_TIMEOUT_MS,
        'getFile',
      );
      if (!file.file_path) return null;

      const token = this.config.get<string>('telegramBotToken')?.trim();
      if (!token) return null;

      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const response = await withTimeout(
        fetch(fileUrl),
        TELEGRAM_API_TIMEOUT_MS,
        'fetchFile',
      );
      if (!response.ok) return null;

      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') || 'image/jpeg',
      };
    } catch {
      this.markFailed(telegramId);
      this.logger.warn(
        `Profile photo download failed telegramId=${telegramId}`,
      );
      return null;
    }
  }
}
