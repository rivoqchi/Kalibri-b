import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(
  '522b272308afc16dca8277d0de94076fa1b84387852a41524e9537e15cec0775',
);

const token = await new SignJWT({ role: 'admin', telegramId: 5079701692 })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject('e2e-admin')
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(secret);

const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
);

const targets = [
  'http://127.0.0.1:8000/api/media/upload?folder=categories',
  'http://127.0.0.1:3000/api/media/upload?folder=categories',
];

const results = [];
for (const url of targets) {
  try {
    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 't.jpg');
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await res.text();
    results.push({ url, status: res.status, body: text.slice(0, 400) });
  } catch (e) {
    results.push({
      url,
      status: 0,
      body: e instanceof Error ? e.message : String(e),
    });
  }
}

const log = {
  sessionId: '572815',
  runId: 'post-fix',
  hypothesisId: 'E',
  location: 'scripts/e2e-proxy-upload.mjs',
  message: 'Proxy upload e2e results',
  data: { results },
  timestamp: Date.now(),
};

mkdirSync(join(process.cwd(), '..', '.cursor'), { recursive: true });
appendFileSync(
  join(process.cwd(), '..', '.cursor', 'debug-572815.log'),
  `${JSON.stringify(log)}\n`,
);
console.log(JSON.stringify(results, null, 2));
