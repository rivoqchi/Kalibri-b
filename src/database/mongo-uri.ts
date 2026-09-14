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
    process.env.USE_IN_MEMORY_MONGO === 'true';

  if (!useMemory) {
    return { uri: configuredUri, mode: 'external' };
  }

  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri('kalibri_texnika');
  logger.warn(`Using in-memory MongoDB at ${uri}`);

  // #region agent log
  fetch('http://127.0.0.1:7580/ingest/34e913d6-8720-4f4c-8d69-15c2fc7de272', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': 'de3394',
    },
    body: JSON.stringify({
      sessionId: 'de3394',
      runId: 'post-fix',
      hypothesisId: 'F',
      location: 'database/mongo-uri.ts:resolveMongoUri',
      message: 'in-memory Mongo started',
      data: { mode: 'memory', hasUri: Boolean(uri) },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return { uri, mode: 'memory' };
}

export async function stopMemoryMongo(): Promise<void> {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
