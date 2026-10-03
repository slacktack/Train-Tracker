'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const KEY = 'tt-nav-stack';

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function write(stack: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-30)));
  } catch {
    // storage unavailable: back falls back to the default page
  }
}

// Mount once. Keeps a small in-app history so Back goes where the user came from, never somewhere invented.
export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const stack = read();
    const last = stack[stack.length - 1];
    if (last === pathname) return;
    if (stack[stack.length - 2] === pathname) stack.pop();
    else stack.push(pathname);
    write(stack);
  }, [pathname]);
  return null;
}

export function useGoBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    if (read().length > 1) router.back();
    else router.push(fallback);
  }, [router, fallback]);
}
