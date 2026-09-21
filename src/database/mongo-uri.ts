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
