import type { UserRole } from '../users/user.schema.js';

export const AUTH_BOT_API = 'AUTH_BOT_API';

export type AuthBotCreateCodeInput = {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
};

export type AuthBotCreateCodeResult =
  | { ok: true; code: string }
  | { ok: false; cooldownSeconds: number };

export type AuthBotEnsureUserInput = {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
};

export type AuthBotApi = {
  resolveRole(phone?: string | null): UserRole;
  createLoginCode(
    input: AuthBotCreateCodeInput,
  ): Promise<AuthBotCreateCodeResult>;
  /** Create/update user from Telegram identity; phone optional. */
  ensureUserFromTelegram(
    input: AuthBotEnsureUserInput,
  ): Promise<{ id: string; phone: string | null }>;
};
