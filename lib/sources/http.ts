export class UpstreamError extends Error {
  constructor(
    public provider: string,
    message: string,
    public status?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = 'UpstreamError';
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function fetchRaw(provider: string, url: string, opts: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 12_000, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new UpstreamError(provider, aborted ? `timed out after ${timeoutMs}ms` : 'network error');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(provider: string, url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetchRaw(provider, url, opts);
  const text = await res.text();
  if (!res.ok) throw new UpstreamError(provider, `HTTP ${res.status}`, res.status);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError(provider, 'invalid JSON response', res.status);
  }
}
