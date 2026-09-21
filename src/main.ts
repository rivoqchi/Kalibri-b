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
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 8000;
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [
    'http://localhost:3000',
  ];
  const nodeEnv = config.get<string>('nodeEnv') ?? 'development';

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

  if (await isPortInUse(port)) {
    console.error(
      `[Kalibri] Port ${port} is already in use. Another API instance is running — stop it first (only one \`npm run start:dev\`).`,
    );
    process.exit(1);
  }

  try {
    await app.listen(port);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EADDRINUSE') {
      console.error(
        `[Kalibri] Port ${port} already in use (EADDRINUSE). Kill the other Nest process, then start once.`,
      );
      process.exit(1);
    }
    throw error;
  }

  console.log(`Kalibri API listening on port ${port}`);
  console.log(`Realtime namespace: /realtime (CORS: ${corsOrigins.join(', ')})`);
}


await bootstrap();
