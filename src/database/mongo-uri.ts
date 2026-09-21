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

  if (!useMemory) {
    logger.log(`Using external MongoDB`);
    return { uri: configuredUri, mode: 'external' };
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
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
