import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { AppModule } from './app.module.js';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor.js';

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createNetServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.close(() => resolve(false));
      })
      .listen(port);
  });
}

type BootState = {
  ready: boolean;
  error: string | null;
  hint: string | null;
};

async function bootstrap() {
  const port = parseInt(process.env.PORT ?? '8000', 10);
  const bootState: BootState = {
    ready: false,
    error: null,
    hint: null,
  };

  // #region agent log
  const bootPayload = {
    sessionId: '411458',
    runId: process.env.DEBUG_RUN_ID ?? 'render-boot',
    hypothesisId: 'H18',
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

  const expressApp = express();
  expressApp.get('/api/health', (req, res, next) => {
    if (bootState.ready) {
      next();
      return;
    }
    res.status(503).json({
      status: bootState.error ? 'boot_failed' : 'starting',
      mongo: 'unknown',
      error: bootState.error,
      hint: bootState.hint,
      hasJwtSecret: Boolean(process.env.JWT_SECRET?.trim()),
      hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
      timestamp: new Date().toISOString(),
    });
  });

  const httpServer = createServer(expressApp);
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '0.0.0.0', () => resolve());
  });
  // #region agent log
  console.log(
    '[boot]',
    JSON.stringify({ hypothesisId: 'H18', earlyListen: true, port }),
  );
  // #endregion

  try {
    // #region agent log
    console.log(
      '[boot]',
      JSON.stringify({
        hypothesisId: 'H17',
        message: 'NestFactory.create starting',
      }),
    );
    // #endregion

    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      { bufferLogs: true, abortOnError: false },
    );

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

    await app.init();
    bootState.ready = true;

    // #region agent log
    console.log(
      '[boot]',
      JSON.stringify({ hypothesisId: 'H18', nestReady: true, port }),
    );
    // #endregion
    console.log(`Kalibri API listening on port ${port}`);
    console.log(
      `Realtime namespace: /realtime (CORS: ${corsOrigins.join(', ')})`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTls =
      /SSL|TLS|CERT|ECONNREFUSED|ServerSelection|whitelist|IP/i.test(message) ||
      (error as { cause?: { code?: string } })?.cause?.code ===
        'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR';
    const isJwt = /JWT_SECRET/i.test(message);
    bootState.error = message;
    bootState.hint = isTls
      ? 'Atlas Network Access must allow 0.0.0.0/0'
      : isJwt
        ? 'Set JWT_SECRET in Render Environment'
        : 'Check Render logs / env vars';

    // #region agent log
    console.error(
      '[boot-fatal]',
      JSON.stringify({
        hypothesisId: isTls ? 'H9' : isJwt ? 'H16' : 'H3',
        message,
        hint: bootState.hint,
        keepingEarlyServerAlive: true,
      }),
    );
    // #endregion

    // Keep PORT open so Render stays up and /api/health surfaces the error.
    console.error(
      '[boot] Nest failed — early /api/health remains on port',
      port,
    );
  }
}

// Local-only duplicate-port guard (skipped in production / early-listen path).
if (
  process.env.NODE_ENV !== 'production' &&
  (await isPortInUse(parseInt(process.env.PORT ?? '8000', 10)))
) {
  console.error(
    `[Kalibri] Port ${process.env.PORT ?? 8000} is already in use. Stop the other API instance first.`,
  );
  process.exit(1);
}

await bootstrap();
