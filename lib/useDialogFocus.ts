'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: HTMLElement[] = [];

// Modal keyboard contract: focus moves in, Tab stays in, Escape closes, focus returns on close.
export function useDialogFocus(ref: RefObject<HTMLElement>, open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const opener = document.activeElement as HTMLElement | null;
    const items = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => (x as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility?.() ?? true);
    const initial = el.querySelector<HTMLElement>('[data-autofocus]') ?? items()[0] ?? el;
    if (initial === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    initial.focus({ preventScroll: true });
    stack.push(el);

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== el) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      stack.splice(stack.indexOf(el), 1);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
