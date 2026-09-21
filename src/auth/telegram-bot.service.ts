import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InlineKeyboard, Keyboard } from 'grammy';
import { AUTH_BOT_API, type AuthBotApi } from './auth-bot.api.js';
import { UsersService } from '../users/users.service.js';
import { TelegramPhotoService } from './telegram-photo.service.js';
import { normalizePhone } from '../common/utils/phone.js';
import { agentDebugLog } from '../common/utils/agent-debug-log.js';

const PHONE_TEXT = 'Telefon raqam yuborish';
const SEND_CODE_TEXT = 'Kod yuborish';
const SHOP_TEXT = "Do'kon";
const BLOCKED_TEXT = 'Bloklangansiz.';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private botUsername: string | null = null;
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
    return Boolean(this.bot && this.botUsername);
  }

  /** Store Mini App root (Do'kon + chat menu). Profile lives under the same origin. */
  private miniAppUrl(): string {
    const base =
      this.config.get<string>('telegramWebAppUrl')?.replace(/\/$/, '') ||
      this.config.get<string>('frontendUrl')?.replace(/\/$/, '') ||
      '';
    if (!base) {
      this.logger.warn('FRONTEND_URL / TELEGRAM_WEBAPP_URL not set');
      return '';
    }
    return `${base}/`;
  }

  /** Telegram Mini App / web_app / url buttons require HTTPS. */
  private canUseWebAppButton(url: string): boolean {
    return url.startsWith('https://');
  }

  private phoneKeyboard() {
    return new Keyboard().requestContact(PHONE_TEXT).resized().persistent();
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

    this.logger.log(`Do'kon open telegramId=${from.id} https=${https} url=${url}`);

    await ctx.reply(
      https
        ? "Do'konni oching — pastdagi Do'kon tugmasi Mini App:"
        : "Mini App uchun TELEGRAM_WEBAPP_URL (HTTPS) kerak. Masalan: https://kalibri-f.vercel.app",
      { reply_markup: await this.shopKeyboard(from.id) },
    );
  }

  async onModuleInit() {
    const token = this.config.get<string>('telegramBotToken')?.trim();
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN yo‘q — Telegram bot ishga tushmadi.');
      return;
    }

    if (this.bot) {
      this.logger.warn('Telegram bot allaqachon ishlayapti — avval to‘xtatilmoqda.');
      await this.bot.stop();
      this.telegramPhoto.attachBot(null);
      this.bot = null;
      this.botUsername = null;
    }

    const miniApp = this.miniAppUrl();
    if (!this.canUseWebAppButton(miniApp)) {
      this.logger.warn(
        `Mini App HTTPS emas (${miniApp || 'empty'}). TELEGRAM_WEBAPP_URL=https://kalibri-f.vercel.app qo‘ying.`,
      );
    } else {
      this.logger.log(`Mini App URL: ${miniApp}`);
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
      this.logger.log(
        `TG update id=${ctx.update.update_id} from=${ctx.from?.id ?? '?'} text=${msg && 'text' in msg ? String(msg.text).slice(0, 40) : '-'}`,
      );
      await next();
    });
    // #endregion

    bot.command('start', async (ctx) => {
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

    bot.on('message:contact', async (ctx) => {
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
        this.logger.log(`Telefon rad etildi (allaqachon bor) telegramId=${from.id}`);
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

      this.logger.log(
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

    bot.hears(SEND_CODE_TEXT, async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      if (await this.rejectIfBlocked(ctx)) return;

      try {
        const existing = await this.usersService.findByTelegramId(from.id);
        const phone = existing?.phone ?? null;

        if (!phone) {
          await ctx.reply(PHONE_TEXT, { reply_markup: this.phoneKeyboard() });
          return;
        }

        // Cooldown/issue message is sent inside sendLoginCode only (no second reply).
        await this.sendLoginCode(ctx, phone);
      } catch (error) {
        this.logger.error('Kod yuborishda xato', error);
        if (error instanceof ForbiddenException) {
          await ctx.reply(BLOCKED_TEXT);
          return;
        }
        await ctx.reply('Kod yuborib bo‘lmadi. Keyinroq urinib ko‘ring.', {
          reply_markup: await this.shopKeyboard(from.id),
        });
      }
    });

    bot.hears(SHOP_TEXT, async (ctx) => {
      try {
        await this.openShop(ctx);
      } catch (error) {
        this.logger.error("Do'kon ochishda xato", error);
        await ctx.reply("Do'konni ochib bo‘lmadi. /start qilib qayta urinib ko‘ring.");
      }
    });

    bot.catch((err) => {
      this.logger.error('Telegram bot xatosi', err.error);
    });

    // Do not block Nest listen() on Telegram network timeouts.
    void this.startPollingWithRetry(bot);
  }

  private async startPollingWithRetry(bot: Bot) {
    const maxAttempts = 8;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const me = await bot.api.getMe();
        this.botUsername = me.username ?? null;
        this.logger.log(`Telegram bot @${this.botUsername} ishga tushmoqda…`);
        // #region agent log
        agentDebugLog({
          hypothesisId: 'F',
          location: 'telegram-bot.service.ts:onStart',
          message: 'Bot getMe ok, starting poll',
          data: { username: this.botUsername, attempt },
          runId: 'post-fix',
        });
        // #endregion
        void bot.start({
          onStart: async () => {
            this.logger.log(`Telegram bot @${this.botUsername} pollingda.`);
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
                this.logger.log(`Mini App menu button set → ${webAppUrl}`);
              } catch (e) {
                this.logger.warn('Mini App menu button o‘rnatilmadi', e);
              }
            }
          },
        });
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Telegram getMe urinish ${attempt}/${maxAttempts} muvaffaqiyatsiz`,
          error,
        );
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    }

    this.logger.error('Telegram botni ishga tushirib bo‘lmadi', lastError);
    this.telegramPhoto.attachBot(null);
    if (this.bot === bot) {
      this.bot = null;
      this.botUsername = null;
    }
  }

  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
    }
    this.telegramPhoto.attachBot(null);
  }
}
