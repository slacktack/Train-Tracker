import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIR = join(process.cwd(), '.cache');

export function readDisk<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(join(DIR, name), 'utf8')) as T;
  } catch {
    return null;
  }
}

// Atomic write; persistence is best-effort (read-only FS on some hosts).
export function writeDisk(name: string, value: unknown): void {
  try {
    mkdirSync(DIR, { recursive: true });
    const tmp = join(DIR, `${name}.${process.pid}.tmp`);
    writeFileSync(tmp, JSON.stringify(value));
    renameSync(tmp, join(DIR, name));
  } catch {
    // ignore
  }
}
