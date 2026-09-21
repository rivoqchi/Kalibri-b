import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';
import { createServer } from 'node:net';
import { AppModule } from './app.module.js';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor.js';

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.close(() => resolve(false));
      })
      .listen(port);
  });
}

async function bootstrap() {
  // #region agent log
  const bootPayload = {
    sessionId: '411458',
    runId: process.env.DEBUG_RUN_ID ?? 'render-boot',
    hypothesisId: 'H1',
    location: 'main.ts:bootstrap',
    message: 'bootstrap start',
    data: {
      nodeEnv: process.env.NODE_ENV ?? null,
      portEnv: process.env.PORT ?? null,
      hasJwtSecret: Boolean(process.env.JWT_SECRET?.trim()),
      hasMongo: Boolean(process.env.MONGODB_URI?.trim()),
      argv0: process.argv[1] ?? null,
    },
    timestamp: Date.now(),
  };
  console.log('[boot]', JSON.stringify(bootPayload.data));
  fetch('http://127.0.0.1:7898/ingest/841f1275-974c-4ae8-9d0d-4af60275142b', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '411458',
    },
    body: JSON.stringify(bootPayload),
  }).catch(() => {});
  // #endregion

  // #region agent log
  console.log(
    '[boot]',
    JSON.stringify({
      hypothesisId: 'H17',
      message: 'NestFactory.create starting (onModuleInit must not await mongo)',
    }),
  );
  // #endregion
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  // #region agent log
  console.log(
    '[boot]',
    JSON.stringify({
      hypothesisId: 'H17',
      message: 'NestFactory.create done',
    }),
  );
  // #endregion

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 8000;
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [
    'http://localhost:3000',
  ];
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';

  // #region agent log
  console.log(
    '[boot]',
    JSON.stringify({
      hypothesisId: 'H2',
      resolvedPort: port,
      nodeEnv,
      corsCount: corsOrigins.length,
    }),
  );
  // #endregion

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.enableCors({
    origin: [
      ...corsOrigins,
      // Local Telegram Mini App tunnels (dev only)
      ...(nodeEnv === 'development'
        ? [/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i]
        : []),
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id'],
  });


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new ResponseTimeInterceptor());

  app.enableShutdownHooks();

  // Port probe races on PaaS; only useful for local single-instance checks.
  if (nodeEnv !== 'production' && (await isPortInUse(port))) {
    console.error(
      `[Kalibri] Port ${port} is already in use. Another API instance is running — stop it first (only one \`npm run start:dev\`).`,
    );
    process.exit(1);
  }

  try {
    // Render requires binding 0.0.0.0 (not only localhost).
    await app.listen(port, '0.0.0.0');
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EADDRINUSE') {
      console.error(
        `[Kalibri] Port ${port} already in use (EADDRINUSE). Kill the other Nest process, then start once.`,
      );
      process.exit(1);
    }
    throw error;
  }

  // #region agent log
  console.log(
    '[boot]',
    JSON.stringify({ hypothesisId: 'H1', listening: true, port }),
  );
  // #endregion
  console.log(`Kalibri API listening on port ${port}`);
  console.log(`Realtime namespace: /realtime (CORS: ${corsOrigins.join(', ')})`);
}

try {
  await bootstrap();
} catch (error) {
  // #region agent log
  const message = error instanceof Error ? error.message : String(error);
  const isTls =
    /SSL|TLS|CERT|ECONNREFUSED|ServerSelection|whitelist|IP/i.test(message) ||
    (error as { cause?: { code?: string } })?.cause?.code ===
      'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR';
  console.error(
    '[boot-fatal]',
    JSON.stringify({
      hypothesisId: isTls ? 'H9' : 'H3',
      name: error instanceof Error ? error.name : 'unknown',
      message,
      hint: isTls
        ? 'Atlas Network Access must allow 0.0.0.0/0 (Render IPs change). Also verify MONGODB_URI user/password URL-encoding.'
        : undefined,
    }),
  );
  // #endregion
  throw error;
}
