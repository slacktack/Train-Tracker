'use client';

import { useEffect, useRef, useState } from 'react';

// Rolls a number toward its target once, then follows later changes quietly.
export function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !first.current) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    if (target === 0) return;
    first.current = false;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}
