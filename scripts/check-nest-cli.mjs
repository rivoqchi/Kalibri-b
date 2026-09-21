import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nestJs = join(root, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
const nestBin = join(root, 'node_modules', '.bin', 'nest');
const nestBinCmd = join(root, 'node_modules', '.bin', 'nest.cmd');

let nestResolved = null;
try {
  nestResolved = require.resolve('@nestjs/cli/package.json');
} catch {
  nestResolved = null;
}

let typesNode = null;
let typesExpress = null;
try {
  typesNode = require.resolve('@types/node/package.json');
} catch {
  typesNode = null;
}
try {
  typesExpress = require.resolve('@types/express/package.json');
} catch {
  typesExpress = null;
}

const payload = {
  sessionId: '411458',
  runId: process.env.DEBUG_RUN_ID ?? 'prebuild',
  hypothesisId: 'A',
  location: 'scripts/check-nest-cli.mjs',
  message: 'prebuild nest CLI + build types check',
  data: {
    nodeEnv: process.env.NODE_ENV ?? null,
    nestJsExists: existsSync(nestJs),
    nestBinExists: existsSync(nestBin) || existsSync(nestBinCmd),
    nestCliResolved: nestResolved,
    typesNodeResolved: typesNode,
    typesExpressResolved: typesExpress,
    ok: Boolean(nestResolved && typesNode && typesExpress && existsSync(nestJs)),
  },
  timestamp: Date.now(),
};

// Visible on Render build logs (runtime evidence)
console.log('[prebuild]', JSON.stringify(payload.data));

// #region agent log
fetch('http://127.0.0.1:7898/ingest/841f1275-974c-4ae8-9d0d-4af60275142b', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Debug-Session-Id': '411458',
  },
  body: JSON.stringify(payload),
}).catch(() => {});
try {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(
    join(root, '..', 'debug-411458.log'),
    `${JSON.stringify(payload)}\n`,
  );
} catch {
  // ignore when log path unavailable (e.g. Render)
}
// #endregion

if (!nestResolved || !existsSync(nestJs)) {
  console.error(
    '@nestjs/cli missing after install. Ensure it is in dependencies (not only devDependencies) for production builds.',
  );
  process.exit(1);
}

if (!typesNode || !typesExpress) {
  console.error(
    'Build type packages missing (@types/node / @types/express). Keep them in dependencies for production builds.',
  );
  process.exit(1);
}
