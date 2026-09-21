import { Logger } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';

const logger = new Logger('MongoBootstrap');

let memoryServer: MongoMemoryServer | null = null;

export async function resolveMongoUri(configuredUri: string): Promise<{
  uri: string;
  mode: 'external' | 'memory';
}> {
  const useMemory =
    configuredUri === 'memory' ||
    configuredUri === '' ||
    process.env.USE_IN_MEMORY_MONGO === 'true';

  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (!useMemory) {
    let host = '(unparsed)';
    try {
      host = new URL(configuredUri.replace(/^mongodb(\+srv)?:/, 'http:')).hostname;
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
    return { uri: configuredUri, mode: 'external' };
  }

  if (nodeEnv === 'production' && process.env.USE_IN_MEMORY_MONGO !== 'true') {
    // #region agent log
    console.error(
      '[boot-fatal]',
      JSON.stringify({
        hypothesisId: 'H7',
        message:
          'MONGODB_URI must be a real MongoDB connection string in production (memory mode OOMs on Render).',
        configuredUri: configuredUri || '(empty)',
      }),
    );
    // #endregion
    throw new Error(
      'MONGODB_URI must be set to a real MongoDB URI in production (not "memory").',
    );
  }

  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri('kalibri_texnika');
  logger.warn(`Using in-memory MongoDB at ${uri}`);

  return { uri, mode: 'memory' };
}

export async function stopMemoryMongo(): Promise<void> {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
