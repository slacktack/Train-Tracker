function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// The Vercel Marketplace Upstash integration names its pair KV_REST_API_*; never mix the two pairs.
const kv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export const env = {
  NEXT_PUBLIC_MAPTILER_API_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY ?? '',
  UPSTASH_REDIS_REST_URL: (kv ? process.env.KV_REST_API_URL : process.env.UPSTASH_REDIS_REST_URL) ?? '',
  UPSTASH_REDIS_REST_TOKEN: (kv ? process.env.KV_REST_API_TOKEN : process.env.UPSTASH_REDIS_REST_TOKEN) ?? '',
};

export function assertServerEnv() {
  required('NEXT_PUBLIC_MAPTILER_API_KEY', env.NEXT_PUBLIC_MAPTILER_API_KEY);
}
