function splitOrigins(raw: string | undefined, fallback: string): string[] {
  const source = raw?.trim() || fallback;
  return source
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET?.trim()) return process.env.JWT_SECRET.trim();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return 'dev-insecure-secret';
}

const defaultFrontend = 'http://localhost:3000';

export default () => ({
  port: parseInt(process.env.PORT ?? '8000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? defaultFrontend,
  /**
   * CORS allowed origins (comma-separated).
   * Defaults to FRONTEND_URL. Example: https://shop.example.com,https://admin.example.com
   */
  corsOrigins: splitOrigins(
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL ?? defaultFrontend,
  ),
  /** HTTPS URL for Telegram Mini App (web_app buttons). Falls back to FRONTEND_URL. */
  telegramWebAppUrl:
    process.env.TELEGRAM_WEBAPP_URL?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    defaultFrontend,
  siteUrl: process.env.SITE_URL ?? defaultFrontend,
  seedDemoCatalog: process.env.SEED_DEMO_CATALOG === 'true',
  mongodbUri: process.env.MONGODB_URI ?? 'memory',
  redisUrl: process.env.REDIS_URL ?? '',
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.CLOUDFLARE_R2_BUCKET ?? 'kalibri-media',
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL ?? '',
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT ?? '',
  },
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS ?? '60', 10),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  jwtSecret: resolveJwtSecret(),
  adminPhone: process.env.ADMIN_PHONE ?? '+998947932005',
  superAdminPhone:
    process.env.SUPER_ADMIN_PHONE ??
    process.env.ADMIN_PHONE ??
    '+998947932005',
  authCodeTtlSeconds: parseInt(process.env.AUTH_CODE_TTL_SECONDS ?? '300', 10),
});
