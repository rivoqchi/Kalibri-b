import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, GrammyError, InlineKeyboard, Keyboard } from 'grammy';
import { AUTH_BOT_API, type AuthBotApi } from './auth-bot.api.js';
import { UsersService } from '../users/users.service.js';
import { TelegramPhotoService } from './telegram-photo.service.js';
import { normalizePhone } from '../common/utils/phone.js';
import { agentDebugLog } from '../common/utils/agent-debug-log.js';

const PHONE_TEXT = 'Telefon raqam yuborish';
const SEND_CODE_TEXT = 'Kod yuborish';
const SHOP_TEXT = "Do'kon";
const BLOCKED_TEXT = 'Bloklangansiz.';
const DB_DOWN_TEXT =
  "Server vaqtincha ma'lumotlar bazasiga ulana olmayapti (MongoDB). Keyinroq urinib ko'ring.";

/** After 409 Conflict: long backoff, few attempts, then stop fighting the other instance. */
const CONFLICT_MAX_RETRIES = 3;
const CONFLICT_BACKOFF_MS = 90_000;

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private botUsername: string | null = null;
  private polling = false;
  private stopRequested = false;
  private conflictRetries = 0;
  /** Telegram often sends /start twice when opening the bot — ignore duplicates. */
  private lastStartAt = new Map<number, number>();

  constructor(
    private readonly config: ConfigService,
    @Inject(AUTH_BOT_API)
    private readonly authService: AuthBotApi,
    private readonly usersService: UsersService,
    private readonly telegramPhoto: TelegramPhotoService,
  ) {}

  getBotUsername(): string | null {
    return this.botUsername;
  }

  isReady(): boolean {
    return Boolean(this.bot && this.botUsername && this.polling);
  }

  /** Store Mini App root (Do'kon + chat menu). Profile lives under the same origin. */
  private miniAppUrl(): string {
    const base =
      this.config.get<string>('telegramWebAppUrl')?.replace(/\/$/, '') ||
      this.config.get<string>('frontendUrl')?.replace(/\/$/, '') ||
      '';
    if (!base) {
      this.tgWarn('FRONTEND_URL / TELEGRAM_WEBAPP_URL not set');
      return '';
    }
    return `${base}/`;
  }

  /** Telegram Mini App / web_app / url buttons require HTTPS. */
  private canUseWebAppButton(url: string): boolean {
    return url.startsWith('https://');
  }

  private tgLog(message: string, ...rest: unknown[]) {
    console.log(`[telegram] ${message}`, ...rest);
    this.logger.log(message);
  }

  private tgWarn(message: string, ...rest: unknown[]) {
    console.warn(`[telegram] ${message}`, ...rest);
    this.logger.warn(message);
  }

  private tgError(message: string, error?: unknown) {
    console.error(`[telegram] ${message}`, error ?? '');
    this.logger.error(message, error);
  }

  private phoneKeyboard() {
    return new Keyboard().requestContact(PHONE_TEXT).resized().persistent();
  }

  private isDbUnavailableError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return /Mongo|Mongoose|buffering timed out|ECONNREFUSED|ServerSelection|Invalid scheme|topology was destroyed|failed to connect/i.test(
      msg,
    );
  }

  private async replyDbDown(ctx: Context): Promise<void> {
    try {
      await ctx.reply(DB_DOWN_TEXT);
    } catch (replyErr) {
      this.tgWarn('DB-down reply failed', replyErr);
    }
  }

  /** Returns true when the user is blocked and a stop reply was sent. */
  private async rejectIfBlocked(ctx: Context): Promise<boolean> {
    const fromId = ctx.from?.id;
    if (!fromId) return false;
    const existing = await this.usersService.findByTelegramId(fromId);
    if (!existing?.isBlocked) return false;
    await ctx.reply(BLOCKED_TEXT);
    return true;
  }

  /** After phone is saved: Kod yuborish + Do'kon (Mini App when TELEGRAM_WEBAPP_URL is HTTPS). */
  private async shopKeyboard(_telegramId?: number) {
    const keyboard = new Keyboard().text(SEND_CODE_TEXT).row();
    const url = this.miniAppUrl();
    if (this.canUseWebAppButton(url)) {
      // Auth via Telegram.WebApp.initData — do not put JWT in web_app URL.
      keyboard.webApp(SHOP_TEXT, url);
    } else {
      keyboard.text(SHOP_TEXT);
    }
    return keyboard.resized().persistent();
  }

  private async sendLoginCode(
    ctx: Context,
    phone: string,
    source: 'kod_yuborish' = 'kod_yuborish',
  ): Promise<'issued' | 'cooldown'> {
    const from = ctx.from;
    if (!from) return 'cooldown';

    // #region agent log
    agentDebugLog({
      hypothesisId: 'B',
      location: 'telegram-bot.service.ts:sendLoginCode',
      message: 'sendLoginCode invoked',
      data: { telegramId: from.id, source },
      runId: 'post-fix',
    });
    // #endregion

    const result = await this.authService.createLoginCode({
      telegramId: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      phone,
    });

    if (!result.ok) {
      const minutes = Math.max(1, Math.ceil(result.cooldownSeconds / 60));
      await ctx.reply(
        `Qayta so‘rash uchun taxminan ${minutes} daqiqa kuting.`,
        {
          reply_markup: await this.shopKeyboard(from.id),
        },
      );
      return 'cooldown';
    }

    await ctx.reply(`<code>${result.code}</code>`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().copyText('Copy', result.code),
    });
    return 'issued';
  }

  private async openShop(ctx: Context) {
    const from = ctx.from;
    if (!from) return;
    if (await this.rejectIfBlocked(ctx)) return;

    const existing = await this.usersService.findByTelegramId(from.id);
    if (!existing?.phone) {
      await ctx.reply(PHONE_TEXT, { reply_markup: this.phoneKeyboard() });
      return;
    }

    const url = this.miniAppUrl();
    const https = this.canUseWebAppButton(url);

    // #region agent log
    agentDebugLog({
      hypothesisId: 'C',
      location: 'telegram-bot.service.ts:openShop',
      message: "Do'kon open requested",
      data: {
        telegramId: from.id,
        httpsWebApp: https,
        miniAppHost: (() => {
          try {
            return new URL(url).host;
          } catch {
            return 'invalid';
          }
        })(),
      },
      runId: 'post-fix',
    });
    // #endregion

    this.tgLog(`Do'kon open telegramId=${from.id} https=${https} url=${url}`);

    await ctx.reply(
      https
        ? "Do'konni oching — pastdagi Do'kon tugmasi Mini App:"
        : "Mini App uchun TELEGRAM_WEBAPP_URL (HTTPS) kerak. Masalan: https://kalibri-f.vercel.app",
      { reply_markup: await this.shopKeyboard(from.id) },
    );
  }

  private async withHandlerGuard(
    ctx: Context,
    label: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        await ctx.reply(BLOCKED_TEXT);
        return;
      }
      if (this.isDbUnavailableError(error)) {
        this.tgError(`${label}: Mongo unavailable`, error);
        await this.replyDbDown(ctx);
        return;
      }
      this.tgError(`${label} failed`, error);
      try {
        await ctx.reply("Xatolik yuz berdi. /start qilib qayta urinib ko'ring.");
      } catch {
        /* ignore */
      }
    }
  }

  async onModuleInit() {
    this.stopRequested = false;
    const token = this.config.get<string>('telegramBotToken')?.trim();
    if (!token) {
      this.tgWarn(
        'boot skip — TELEGRAM_BOT_TOKEN missing. Set it in Render Environment.',
      );
      return;
    }

    const pollingEnabled = this.config.get<boolean>('telegramBotPolling');
    if (!pollingEnabled) {
      this.tgLog('polling disabled (TELEGRAM_BOT_POLLING=false)');
      return;
    }

    this.tgLog(
      `boot begin tokenLen=${token.length} nodeEnv=${this.config.get('nodeEnv')}`,
    );

    if (this.bot) {
      this.tgWarn('bot already running — stopping previous instance');
      this.polling = false;
      await this.bot.stop();
      this.telegramPhoto.attachBot(null);
      this.bot = null;
      this.botUsername = null;
    }

    const miniApp = this.miniAppUrl();
    if (!this.canUseWebAppButton(miniApp)) {
      this.tgWarn(
        `Mini App HTTPS emas (${miniApp || 'empty'}). TELEGRAM_WEBAPP_URL=https://kalibri-f.vercel.app qo‘ying.`,
      );
    } else {
      this.tgLog(`Mini App URL: ${miniApp}`);
    }

    // Keep grammy default node-fetch (native fetch breaks AbortSignal from grammy shim).
    // First getMe often times out to api.telegram.org — retry below.
    const bot = new Bot(token, {
      client: {
        timeoutSeconds: 45,
      },
    });
    this.bot = bot;
    this.telegramPhoto.attachBot(bot);

    // #region agent log
    bot.use(async (ctx, next) => {
      const msg = ctx.message;
      agentDebugLog({
        hypothesisId: 'F',
        location: 'telegram-bot.service.ts:middleware',
        message: 'Update received',
        data: {
          updateId: ctx.update.update_id,
          hasContact: Boolean(msg && 'contact' in msg && msg.contact),
          text:
            msg && 'text' in msg && typeof msg.text === 'string'
              ? msg.text.slice(0, 40)
              : null,
          fromId: ctx.from?.id ?? null,
        },
      });
      this.tgLog(
        `update id=${ctx.update.update_id} from=${ctx.from?.id ?? '?'} text=${msg && 'text' in msg ? String(msg.text).slice(0, 40) : '-'}`,
      );
      await next();
    });
    // #endregion

    bot.command('start', async (ctx) => {
      await this.withHandlerGuard(ctx, '/start', async () => {
        const fromId = ctx.from?.id;
        if (fromId) {
          const now = Date.now();
          const last = this.lastStartAt.get(fromId) ?? 0;
          if (now - last < 3000) {
            // #region agent log
            agentDebugLog({
              hypothesisId: 'G',
              location: 'telegram-bot.service.ts:start',
              message: '/start deduplicated',
              data: { fromId, msSinceLast: now - last },
              runId: 'post-fix',
            });
            // #endregion
            return;
          }
          this.lastStartAt.set(fromId, now);
        }

        if (await this.rejectIfBlocked(ctx)) return;

        const existing = ctx.from
          ? await this.usersService.findByTelegramId(ctx.from.id)
          : null;

        if (existing?.phone && ctx.from) {
          await ctx.reply(
            "Telefon saqlangan. Kod oling yoki Do'konni oching.",
            { reply_markup: await this.shopKeyboard(ctx.from.id) },
          );
          return;
        }

        await ctx.reply(
          'Boshlash uchun telefon raqamingizni yuboring (faqat bir marta).',
          { reply_markup: this.phoneKeyboard() },
        );
      });
    });

    bot.on('message:contact', async (ctx) => {
      await this.withHandlerGuard(ctx, 'contact', async () => {
        const contact = ctx.message.contact;
        const from = ctx.from;
        if (!from || !contact?.phone_number) return;
        if (await this.rejectIfBlocked(ctx)) return;

        const already = await this.usersService.findByTelegramId(from.id);
        if (already?.phone) {
          // #region agent log
          agentDebugLog({
            hypothesisId: 'A',
            location: 'telegram-bot.service.ts:contact',
            message: 'Contact rejected — phone already saved',
            data: { telegramId: from.id },
          });
          // #endregion
          this.tgLog(`Telefon rad etildi (allaqachon bor) telegramId=${from.id}`);
          await ctx.reply(
            'Telefon raqamingiz allaqachon saqlangan. Kod yuborish yoki Do\'konni tanlang.',
            { reply_markup: await this.shopKeyboard(from.id) },
          );
          return;
        }

        if (contact.user_id && contact.user_id !== from.id) {
          await ctx.reply(PHONE_TEXT, { reply_markup: this.phoneKeyboard() });
          return;
        }

        const phone = normalizePhone(contact.phone_number);
        if (!phone) {
          await ctx.reply(PHONE_TEXT, { reply_markup: this.phoneKeyboard() });
          return;
        }

        const role = this.authService.resolveRole(phone);
        await this.usersService.upsertFromTelegram({
          telegramId: from.id,
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
          phone,
          role,
        });

        this.tgLog(
          `Telefon saqlandi telegramId=${from.id} phone=${phone} role=${role}`,
        );

        // #region agent log
        agentDebugLog({
          hypothesisId: 'A',
          location: 'telegram-bot.service.ts:contact',
          message: 'Contact accepted — first phone save',
          data: { telegramId: from.id, role },
        });
        // #endregion

        await ctx.reply(
          "Telefon qabul qilindi. Kod olish uchun «Kod yuborish», do'kon uchun «Do'kon» tugmasini bosing.",
          { reply_markup: await this.shopKeyboard(from.id) },
        );

        // #region agent log
        agentDebugLog({
          hypothesisId: 'B',
          location: 'telegram-bot.service.ts:contact',
          message: 'Contact saved — no auto code',
          data: { telegramId: from.id },
          runId: 'post-fix',
        });
        // #endregion
      });
    });

    bot.hears(SEND_CODE_TEXT, async (ctx) => {
      await this.withHandlerGuard(ctx, 'kod_yuborish', async () => {
        const from = ctx.from;
        if (!from) return;
        if (await this.rejectIfBlocked(ctx)) return;

        const existing = await this.usersService.findByTelegramId(from.id);
        const phone = existing?.phone ?? null;

        if (!phone) {
          await ctx.reply(PHONE_TEXT, { reply_markup: this.phoneKeyboard() });
          return;
        }

        // Cooldown/issue message is sent inside sendLoginCode only (no second reply).
        await this.sendLoginCode(ctx, phone);
      });
    });

    bot.hears(SHOP_TEXT, async (ctx) => {
      await this.withHandlerGuard(ctx, 'shop', async () => {
        await this.openShop(ctx);
      });
    });

    bot.catch((err) => {
      const error = err.error;
      if (
        error instanceof GrammyError &&
        error.error_code === 409
      ) {
        this.tgError(
          '409 Conflict on getUpdates — another process is polling this token (local + Render, or multiple instances). Stop duplicates.',
          error,
        );
        this.polling = false;
        return;
      }
      if (this.isDbUnavailableError(error)) {
        this.tgError('handler Mongo error (bot.catch)', error);
        return;
      }
      this.tgError('bot.catch', error);
    });

    // Do not block Nest listen() on Telegram network timeouts.
    // Bot starts even when Mongo is down — handlers reply with DB_DOWN_TEXT.
    void this.startPollingWithRetry(bot);
  }

  private formatTelegramError(error: unknown): string {
    if (error instanceof GrammyError) {
      return `GrammyError ${error.error_code} ${error.description}`;
    }
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return String(error);
  }

  private async clearWebhook(bot: Bot): Promise<void> {
    try {
      await bot.api.deleteWebhook({ drop_pending_updates: false });
      this.tgLog('deleteWebhook ok (polling mode)');
    } catch (error) {
      this.tgWarn(
        `deleteWebhook failed: ${this.formatTelegramError(error)}`,
      );
    }
  }

  private async handlePollingConflict(bot: Bot, detail: string): Promise<void> {
    this.conflictRetries += 1;
    const attempt = this.conflictRetries;
    if (attempt > CONFLICT_MAX_RETRIES) {
      this.tgError(
        `polling STOPPED after ${CONFLICT_MAX_RETRIES}×409 Conflict — only one getUpdates allowed per token. ` +
          `Another process is polling (local npm run start:dev and/or a second Render instance). ` +
          `Stop the other instance, or set TELEGRAM_BOT_POLLING=false on the process that must not poll. ` +
          `This process will not retry until restart. ${detail}`,
      );
      this.polling = false;
      return;
    }

    this.tgError(
      `polling stopped: 409 Conflict (retry ${attempt}/${CONFLICT_MAX_RETRIES} in ${CONFLICT_BACKOFF_MS / 1000}s) — ` +
        `only one getUpdates allowed per token. Stop local start:dev or the other Render instance. ${detail}`,
    );
    if (!this.stopRequested && this.bot === bot) {
      await new Promise((r) => setTimeout(r, CONFLICT_BACKOFF_MS));
      void this.startPollingWithRetry(bot);
    }
  }

  private async startPollingWithRetry(bot: Bot) {
    // Keep retrying getMe in production — Render cold start + Telegram timeouts are common.
    const maxAttempts = 30;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.stopRequested || this.bot !== bot) {
        this.tgWarn('boot aborted (stop or replaced)');
        return;
      }

      try {
        await this.clearWebhook(bot);
        const me = await bot.api.getMe();
        this.botUsername = me.username ?? null;
        this.tgLog(
          `getMe ok @${this.botUsername} attempt=${attempt}/${maxAttempts} — starting poll`,
        );
        // #region agent log
        agentDebugLog({
          hypothesisId: 'F',
          location: 'telegram-bot.service.ts:onStart',
          message: 'Bot getMe ok, starting poll',
          data: { username: this.botUsername, attempt },
          runId: 'post-fix',
        });
        // #endregion

        void bot
          .start({
            onStart: async () => {
              this.polling = true;
              this.conflictRetries = 0;
              this.tgLog(`polling active @${this.botUsername}`);
              agentDebugLog({
                hypothesisId: 'F',
                location: 'telegram-bot.service.ts:polling',
                message: 'Grammy onStart — polling active',
                data: { username: this.botUsername },
                runId: 'post-fix',
              });
              const webAppUrl = this.miniAppUrl();
              if (this.canUseWebAppButton(webAppUrl)) {
                try {
                  await bot.api.setChatMenuButton({
                    menu_button: {
                      type: 'web_app',
                      text: SHOP_TEXT,
                      web_app: { url: webAppUrl },
                    },
                  });
                  this.tgLog(`menu button set → ${webAppUrl}`);
                } catch (e) {
                  this.tgWarn('menu button failed', e);
                }
              }
            },
          })
          .catch(async (error) => {
            this.polling = false;
            const detail = this.formatTelegramError(error);
            if (error instanceof GrammyError && error.error_code === 409) {
              await this.handlePollingConflict(bot, detail);
              return;
            }
            this.tgError(`polling stopped: ${detail}`, error);
            if (!this.stopRequested && this.bot === bot) {
              await new Promise((r) => setTimeout(r, 5_000));
              void this.startPollingWithRetry(bot);
            }
          });
        return;
      } catch (error) {
        lastError = error;
        const detail = this.formatTelegramError(error);
        if (error instanceof GrammyError && error.error_code === 401) {
          this.tgError(
            `boot fail — TELEGRAM_BOT_TOKEN invalid (401). Check Render env. ${detail}`,
          );
          break;
        }
        if (error instanceof GrammyError && error.error_code === 409) {
          await this.handlePollingConflict(bot, detail);
          return;
        }
        this.tgWarn(
          `getMe attempt ${attempt}/${maxAttempts} failed: ${detail}`,
        );
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, Math.min(1500 * attempt, 15_000)));
        }
      }
    }

    this.tgError(
      `boot fail after ${maxAttempts} getMe attempts: ${this.formatTelegramError(lastError)}`,
      lastError,
    );
    this.polling = false;
    this.telegramPhoto.attachBot(null);
    if (this.bot === bot) {
      this.bot = null;
      this.botUsername = null;
    }
  }

  async onModuleDestroy() {
    this.stopRequested = true;
    this.polling = false;
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
    }
    this.botUsername = null;
    this.telegramPhoto.attachBot(null);
    this.tgLog('stopped');
  }
}
