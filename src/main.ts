import { createServer } from 'node:http';

type BootState = {
  ready: boolean;
  error: string | null;
  hint: string | null;
};

const port = parseInt(process.env.PORT ?? '8000', 10);
const bootState: BootState = {
  ready: false,
  error: null,
  hint: null,
};

// Bind PORT before loading Nest/AppModule (those imports can OOM or hang on Render).
const httpServer = createServer((req, res) => {
  const path = req.url?.split('?')[0] ?? '';
  if (path === '/api/health') {
    if (bootState.ready) {
      // Nest Express app will handle after it attaches — until then keep responding.
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          mongo: 'unknown',
          note: 'nest-ready-pending-proxy',
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        status: bootState.error ? 'boot_failed' : 'starting',
        mongo: 'unknown',
        error: bootState.error,
        hint: bootState.hint,
        hasJwtSecret: Boolean(process.env.JWT_SECRET?.trim()),
        hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
        earlyWrapper: true,
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  if (!bootState.ready) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(bootState.error ? `boot_failed: ${bootState.error}` : 'starting');
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

await new Promise<void>((resolve, reject) => {
  httpServer.once('error', reject);
  httpServer.listen(port, '0.0.0.0', () => resolve());
});

// #region agent log
console.log(
  '[boot]',
  JSON.stringify({
    hypothesisId: 'H20',
    earlyListen: true,
    port,
    beforeNestImport: true,
    hasJwtSecret: Boolean(process.env.JWT_SECRET?.trim()),
    hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
  }),
);
// #endregion

try {
  const { startNestOnServer } = await import('./nest-bootstrap.js');
  await startNestOnServer(httpServer, bootState);
  bootState.ready = true;
  // #region agent log
  console.log(
    '[boot]',
    JSON.stringify({ hypothesisId: 'H20', nestReady: true, port }),
  );
  // #endregion
  console.log(`Kalibri API listening on port ${port}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const isTls = /SSL|TLS|ServerSelection|whitelist|IP/i.test(message);
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
      hypothesisId: isTls ? 'H9' : isJwt ? 'H16' : 'H20',
      message,
      hint: bootState.hint,
      keepingEarlyServerAlive: true,
    }),
  );
  // #endregion
  console.error('[boot] Nest failed — early /api/health remains on port', port);
}
