import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const MIRROR_TIMEOUT_MS = 20_000;
const CURL_TIMEOUT_MS = 25_000;
const USER_AGENT =
  'TrainTracker/1.0 (https://github.com/tushargautam/Train-Tracker; rail tracing and terrain)';

type OverpassInit = RequestInit & { next?: { revalidate?: number } };

async function fetchViaCurl(query: string): Promise<unknown> {
  let lastError: unknown = null;
  for (const url of MIRRORS) {
    try {
      const { stdout } = await execFileAsync(
        'curl',
        [
          '-sS',
          '--max-time',
          String(Math.floor(CURL_TIMEOUT_MS / 1000)),
          '-X',
          'POST',
          '-H',
          'Content-Type: application/x-www-form-urlencoded',
          '-H',
          `User-Agent: ${USER_AGENT}`,
          '--data-urlencode',
          `data=${query}`,
          url,
        ],
        { timeout: CURL_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 }
      );
      return JSON.parse(stdout);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All Overpass mirrors failed (curl)');
}

export async function fetchOverpassJson(query: string, init: OverpassInit = {}): Promise<unknown> {
  let lastError: unknown = null;
  for (const url of MIRRORS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MIRROR_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...init,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status} from ${url}`);
      return await res.json();
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  // Some mirrors whitelist by TLS fingerprint: Node's undici gets 403 while
  // curl passes (verified: overpass.openstreetmap.fr). Fall back to a real
  // curl subprocess so rail tracing still gets real geometry.
  try {
    return await fetchViaCurl(query);
  } catch (e) {
    lastError = e;
  }
  throw lastError instanceof Error ? lastError : new Error('All Overpass mirrors failed');
}
