import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InlineKeyboard, Keyboard } from 'grammy';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { normalizePhone } from '../common/utils/phone.js';

const PHONE_TEXT = 'Telefon raqam yuborish';
const SEND_CODE_TEXT = 'Kod yuborish';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private botUsername: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  getBotUsername(): string | null {
    return this.botUsername;
  }

  isReady(): boolean {
    return Boolean(this.bot && this.botUsername);
  }

  private phoneKeyboard() {
    return new Keyboard().requestContact(PHONE_TEXT).resized().persistent();
  }

  private codeKeyboard() {
    return new Keyboard().text(SEND_CODE_TEXT).resized().persistent();
  }

  private async sendLoginCode(ctx: Context, phone: string) {
    const from = ctx.from;
    if (!from) return;

    const code = await this.authService.createLoginCode({
      telegramId: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      phone,
    });

    await ctx.reply(`<code>${code}</code>`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().copyText('Copy', code),
    });
  }

  async onModuleInit() {
    const token = this.config.get<string>('telegramBotToken')?.trim();
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN yo‘q — Telegram bot ishga tushmadi.');
      return;
    }

    const bot = new Bot(token);
    this.bot = bot;

    bot.command('start', async (ctx) => {
      const existing = ctx.from
        ? await this.usersService.findByTelegramId(ctx.from.id)
        : null;

      if (existing?.phone) {
        await ctx.reply(SEND_CODE_TEXT, {
          reply_markup: this.codeKeyboard(),
        });
        return;
      }

      await ctx.reply(PHONE_TEXT, {
        reply_markup: this.phoneKeyboard(),
      });
    });

    bot.on('message:contact', async (ctx) => {
      const contact = ctx.message.contact;
      const from = ctx.from;
      if (!from || !contact?.phone_number) return;

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

      try {
        await this.sendLoginCode(ctx, phone);
        await ctx.reply(SEND_CODE_TEXT, {
          reply_markup: this.codeKeyboard(),
        });
      } catch (error) {
        this.logger.error('Kod yuborishda xato', error);
        await ctx.reply('Kod');
      }
    });

    bot.hears(SEND_CODE_TEXT, async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      try {
        const existing = await this.usersService.findByTelegramId(from.id);
        const phone = existing?.phone ?? null;

        if (!phone) {
          await ctx.reply(PHONE_TEXT, { reply_markup: this.phoneKeyboard() });
          return;
        }

        await this.sendLoginCode(ctx, phone);
      } catch (error) {
        this.logger.error('Kod yuborishda xato', error);
        await ctx.reply('Kod');
      }
    });

    bot.catch((err) => {
      this.logger.error('Telegram bot xatosi', err.error);
    });

    try {
      const me = await bot.api.getMe();
      this.botUsername = me.username ?? null;
      this.logger.log(`Telegram bot @${this.botUsername} ishga tushmoqda…`);
      void bot.start({
        onStart: () => {
          this.logger.log(`Telegram bot @${this.botUsername} pollingda.`);
        },
      });
    } catch (error) {
      this.logger.error('Telegram botni ishga tushirib bo‘lmadi', error);
      this.bot = null;
      this.botUsername = null;
    }
  }

  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
    }
  }
}
