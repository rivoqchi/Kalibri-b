import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Prefer workspace `debug-23a3c1.log` (and `.cursor` mirror).
 * Nest `cwd` is usually `Kalibri-b`, so go one level up.
 */
const CANDIDATES = [
  join(process.cwd(), '..', 'debug-23a3c1.log'),
  join(process.cwd(), '..', '.cursor', 'debug-23a3c1.log'),
  join(process.cwd(), 'debug-23a3c1.log'),
  'C:\\Users\\islom\\Desktop\\kALIBRI\\debug-23a3c1.log',
  'C:\\Users\\islom\\Desktop\\kALIBRI\\.cursor\\debug-23a3c1.log',
];

function writeLine(line: string) {
  for (const path of CANDIDATES) {
    try {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, line, 'utf8');
      return path;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Dual-write debug NDJSON (file + optional ingest). Never log secrets. */
export function agentDebugLog(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}) {
  const body = {
    sessionId: '23a3c1',
    runId: payload.runId ?? 'post-fix',
    hypothesisId: payload.hypothesisId,
    location: payload.location,
    message: payload.message,
    data: payload.data ?? {},
    timestamp: Date.now(),
  };
  writeLine(`${JSON.stringify(body)}\n`);
  fetch('http://127.0.0.1:7898/ingest/841f1275-974c-4ae8-9d0d-4af60275142b', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '23a3c1',
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}
