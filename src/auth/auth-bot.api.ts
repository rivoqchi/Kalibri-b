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

export type AuthBotApi = {
  resolveRole(phone?: string | null): UserRole;
  createLoginCode(
    input: AuthBotCreateCodeInput,
  ): Promise<AuthBotCreateCodeResult>;
};
