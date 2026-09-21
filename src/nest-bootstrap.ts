import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import type { Server } from 'node:http';
import { AppModule } from './app.module.js';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor.js';

type BootState = {
  ready: boolean;
  error: string | null;
  hint: string | null;
};

/**
 * Attach Nest to an already-listening HTTP server (Render early-bind).
 */
export async function startNestOnServer(
  httpServer: Server,
  bootState: BootState,
): Promise<void> {
  // #region agent log
  console.log(
    '[boot]',
    JSON.stringify({
      hypothesisId: 'H20',
      message: 'loading Nest AppModule',
    }),
  );
  // #endregion

  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bufferLogs: true, abortOnError: false },
  );

  app.useWebSocketAdapter(new IoAdapter(httpServer));

  const config = app.get(ConfigService);
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [
    'http://localhost:3000',
  ];
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';

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

  // Route remaining requests through Nest's Express instance.
  httpServer.removeAllListeners('request');
  httpServer.on('request', expressApp);

  bootState.ready = true;
  console.log(
    `Realtime namespace: /realtime (CORS: ${corsOrigins.join(', ')})`,
  );
}
