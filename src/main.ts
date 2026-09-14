import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor.js';

async function bootstrap() {
  // #region agent log
  try {
    const mongooseMod = await import('mongoose');
    const starKeys = Object.keys(mongooseMod);
    const payload = {
      sessionId: 'de3394',
      runId: 'repro-1',
      hypothesisId: 'A',
      location: 'main.ts:bootstrap-mongoose-probe',
      message: 'mongoose module export probe before AppModule',
      data: {
        starHasConnection: 'Connection' in mongooseMod,
        starConnectionType: typeof (mongooseMod as { Connection?: unknown }).Connection,
        defaultHasConnection: Boolean(
          mongooseMod.default &&
            typeof mongooseMod.default === 'object' &&
            'Connection' in mongooseMod.default,
        ),
        defaultConnectionType:
          mongooseMod.default &&
          typeof mongooseMod.default === 'object'
            ? typeof (mongooseMod.default as { Connection?: unknown }).Connection
            : 'no-default',
        starKeySample: starKeys.slice(0, 20),
        version:
          (mongooseMod as { version?: string }).version ??
          (mongooseMod.default as { version?: string } | undefined)?.version,
      },
      timestamp: Date.now(),
    };
    await fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'de3394',
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (error) {
    await fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'de3394',
      },
      body: JSON.stringify({
        sessionId: 'de3394',
        runId: 'repro-1',
        hypothesisId: 'C',
        location: 'main.ts:bootstrap-mongoose-probe-error',
        message: 'mongoose import itself failed',
        data: { error: String(error) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  // #region agent log
  let AppModule: Awaited<typeof import('./app.module.js')>['AppModule'];
  try {
    ({ AppModule } = await import('./app.module.js'));
    await fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'de3394',
      },
      body: JSON.stringify({
        sessionId: 'de3394',
      runId: 'post-fix',
      hypothesisId: 'B',
      location: 'main.ts:app-module-import',
      message: 'AppModule imported successfully',
      data: { ok: true },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  } catch (error) {
    await fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'de3394',
      },
      body: JSON.stringify({
        sessionId: 'de3394',
        runId: 'post-fix',
        hypothesisId: 'A',
        location: 'main.ts:app-module-import-error',
        message: 'AppModule import failed',
        data: {
          error: String(error),
          isNamedExportError: String(error).includes('does not provide an export named'),
          mentionsConnection: String(error).includes('Connection'),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    throw error;
  }
  // #endregion

  // #region agent log
  let app;
  try {
    app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });
    await fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'de3394',
      },
      body: JSON.stringify({
        sessionId: 'de3394',
        runId: 'post-fix',
        hypothesisId: 'F',
        location: 'main.ts:nest-created',
        message: 'NestFactory.create succeeded',
        data: { ok: true },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch (error) {
    await fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'de3394',
      },
      body: JSON.stringify({
        sessionId: 'de3394',
        runId: 'post-fix',
        hypothesisId: 'F',
        location: 'main.ts:nest-create-error',
        message: 'NestFactory.create failed',
        data: {
          error: String(error),
          isMongoRefused: String(error).includes('ECONNREFUSED'),
          mentions27017: String(error).includes('27017'),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    throw error;
  }
  // #endregion

  const config = app.get(ConfigService);
  const frontendUrl = config.get<string>('frontendUrl') ?? 'http://localhost:3000';
  const port = config.get<number>('port') ?? 8000;

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000'],
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

  // #region agent log
  {
    const net = await import('node:net');
    const portInUse = await new Promise<boolean>((resolve) => {
      const tester = net
        .createServer()
        .once('error', () => resolve(true))
        .once('listening', () => {
          tester.close(() => resolve(false));
        })
        .listen(port);
    });
    await fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '0a24d7',
      },
      body: JSON.stringify({
        sessionId: '0a24d7',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'main.ts:pre-listen',
        message: 'Port occupancy check before app.listen',
        data: {
          port,
          portInUse,
          pid: process.pid,
          ppid: process.ppid,
          argv: process.argv.slice(0, 3),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  try {
    await app.listen(port);
  } catch (error) {
    // #region agent log
    await fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '0a24d7',
      },
      body: JSON.stringify({
        sessionId: '0a24d7',
        runId: 'pre-fix',
        hypothesisId: 'B',
        location: 'main.ts:listen-error',
        message: 'app.listen failed',
        data: {
          port,
          pid: process.pid,
          ppid: process.ppid,
          code: (error as NodeJS.ErrnoException)?.code,
          errno: (error as NodeJS.ErrnoException)?.errno,
          error: String(error),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    throw error;
  }

  // #region agent log
  await fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '0a24d7',
    },
    body: JSON.stringify({
      sessionId: '0a24d7',
      runId: 'pre-fix',
      hypothesisId: 'D',
      location: 'main.ts:listening',
      message: 'API server listening',
      data: { port, pid: process.pid, ppid: process.ppid },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  console.log(`Kalibri API listening on http://localhost:${port}`);
  console.log(`Realtime namespace: ws://localhost:${port}/realtime`);
}

await bootstrap();
