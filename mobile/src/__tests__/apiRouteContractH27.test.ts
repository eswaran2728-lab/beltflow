/**
 * H27 API route contract (mobile <-> backend).
 *
 * Found during H27: 15 of 19 mobile services called paths such as
 * "/learning/lessons" while the backend only serves "/api/v1/learning/...",
 * and the base URL has no "/api/v1". Every H16-H26 screen would have got
 * 404 on a real device; mocked screen tests could not see it.
 *
 * 1. The API client sends relative paths under /api/v1 (and leaves explicit
 *    /api/... and absolute URLs alone).
 * 2. Every path used by every mobile service matches a route prefix that
 *    the backend actually mounts (read from server/src/app.ts).
 */
import fs from 'fs';
import path from 'path';
import { apiClient } from '../services/apiClient';
import { getApiBaseUrl } from '../config/env';

const SERVICES_DIR = path.join(__dirname, '../services');
const SERVER_SRC = path.join(__dirname, '../../../server/src');

function okResponse() {
  return {
    ok: true, status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({}),
  } as any;
}

describe('H27 API client prefix', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  test.each([
    ['/learning/lessons', '/api/v1/learning/lessons'],
    ['/assistant/ask', '/api/v1/assistant/ask'],
    ['/api/v1/auth/me', '/api/v1/auth/me'],
    ['/api/health', '/api/health'],
    ['learning/lessons', '/api/v1/learning/lessons'],
  ])('%s -> %s', async (input, expected) => {
    global.fetch = jest.fn().mockResolvedValue(okResponse());
    await apiClient.get(input, { requiresAuth: false });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(`${getApiBaseUrl()}${expected}`);
  });

  test('absolute URLs are not rewritten', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse());
    await apiClient.get('https://example.test/x', { requiresAuth: false });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://example.test/x');
  });
});

describe('H27 mobile services only call routes the backend serves', () => {
  const appSource = fs.readFileSync(path.join(SERVER_SRC, 'app.ts'), 'utf8');
  const mounted = new Set(Array.from(appSource.matchAll(/app\.(?:use|get|post)\('\/api\/v1\/([a-z-]+)['/]/g)).map(m => m[1]));
  // Routers mounted directly at /api/v1 expose their own first path segment.
  for (const file of ['handover.routes.ts', 'onboardingImports.routes.ts']) {
    const src = fs.readFileSync(path.join(SERVER_SRC, 'routes', file), 'utf8');
    for (const m of src.matchAll(/router\.(?:get|post|put|patch|delete)\('\/([a-z-]+)/g)) mounted.add(m[1]);
  }
  mounted.add('health');

  const calls: { file: string; raw: string; segment: string }[] = [];
  for (const file of fs.readdirSync(SERVICES_DIR).filter(f => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(SERVICES_DIR, file), 'utf8');
    for (const m of src.matchAll(/apiClient\.(?:get|post|put|patch|delete)(?:<[^>]*>)?\(\s*['`]([^'`$?]*)/g)) {
      const raw = m[1];
      const normalised = raw.startsWith('/api/') ? raw : `/api/v1/${raw.replace(/^\/+/, '')}`;
      const segment = normalised.replace(/^\/api\/(?:v1\/)?/, '').split('/')[0];
      calls.push({ file, raw, segment });
    }
  }

  test('found service calls to check', () => {
    expect(calls.length).toBeGreaterThan(80);
  });

  test('every service path maps to a mounted backend route', () => {
    const unknown = calls.filter(c => !mounted.has(c.segment)).map(c => `${c.file}: ${c.raw}`);
    expect(unknown).toEqual([]);
  });
});
