import { Logger } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  redactMongoUriForLog,
  sanitizeMongoUri,
} from './sanitize-mongo-uri.js';

const logger = new Logger('MongoBootstrap');

let memoryServer: MongoMemoryServer | null = null;

export async function resolveMongoUri(configuredUri: string): Promise<{
  uri: string;
  mode: 'external' | 'memory';
}> {
  const uri = sanitizeMongoUri(configuredUri);
  const useMemory =
    uri === 'memory' ||
    uri === '' ||
    process.env.USE_IN_MEMORY_MONGO === 'true';

  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (!useMemory) {
    const schemeOk =
      uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
    if (!schemeOk) {
      const uriStartsWith = redactMongoUriForLog(uri).slice(0, 20);
      console.error(
        '[boot]',
        JSON.stringify({
          hypothesisId: 'H21',
          mongo: 'invalid_scheme',
          message:
            'MONGODB_URI must start with mongodb:// or mongodb+srv://. Nest will start but Mongo stays down — Telegram handlers that need DB will fail until fixed.',
          uriStartsWith,
          schemeOk: false,
        }),
      );
      logger.error(
        `Invalid MONGODB_URI scheme (expected mongodb:// or mongodb+srv://). uriStartsWith=${uriStartsWith} schemeOk=false`,
      );
      // Do not throw — keep Nest + Telegram polling alive; health reports mongo:down.
    }

    let host = '(unparsed)';
    try {
      host = new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:')).hostname;
    } catch {
      host = '(invalid-uri)';
    }
    const isLocalHost =
      host === '127.0.0.1' ||
      host === 'localhost' ||
      host === '::1' ||
      host === '0.0.0.0';

    // #region agent log
    console.log(
      '[boot]',
      JSON.stringify({
        hypothesisId: 'H8',
        mongoMode: 'external',
        mongoHost: host,
        isLocalHost,
        nodeEnv,
      }),
    );
    // #endregion

    if (nodeEnv === 'production' && isLocalHost) {
      // #region agent log
      console.error(
        '[boot-fatal]',
        JSON.stringify({
          hypothesisId: 'H8',
          message:
            'MONGODB_URI points at localhost — Render cannot reach your PC MongoDB. Use MongoDB Atlas (or any remote URI).',
          mongoHost: host,
        }),
      );
      // #endregion
      throw new Error(
        'MONGODB_URI must not be localhost in production. Use MongoDB Atlas (mongodb+srv://...).',
      );
    }

    logger.log(`Using external MongoDB host=${host}`);
    return { uri, mode: 'external' };
  }

  if (nodeEnv === 'production' && process.env.USE_IN_MEMORY_MONGO !== 'true') {
    // #region agent log
    console.error(
      '[boot-fatal]',
      JSON.stringify({
        hypothesisId: 'H7',
        message:
          'MONGODB_URI must be a real MongoDB connection string in production (memory mode OOMs on Render).',
        uriStartsWith: redactMongoUriForLog(uri || '(empty)').slice(0, 20),
        schemeOk: false,
      }),
    );
    // #endregion
    throw new Error(
      'MONGODB_URI must be set to a real MongoDB URI in production (not "memory").',
    );
  }

  memoryServer = await MongoMemoryServer.create();
  const memoryUri = memoryServer.getUri('kalibri_texnika');
  logger.warn(`Using in-memory MongoDB at ${memoryUri}`);

  return { uri: memoryUri, mode: 'memory' };
}

export async function stopMemoryMongo(): Promise<void> {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
