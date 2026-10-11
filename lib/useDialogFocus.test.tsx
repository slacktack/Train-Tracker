import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useDialogFocus } from './useDialogFocus';

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, open, () => {
    onClose();
    setOpen(false);
  });
  return (
    <>
      <button onClick={() => setOpen(true)}>opener</button>
      {open && (
        <div ref={ref} role="dialog">
          <button>first</button>
          <button>last</button>
        </div>
      )}
    </>
  );
}

describe('useDialogFocus', () => {
  it('focuses in, wraps Tab, closes on Escape and restores focus', () => {
    const onClose = vi.fn();
    const { getByText } = render(<Harness onClose={onClose} />);
    const opener = getByText('opener');
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(getByText('first'));
    getByText('last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByText('first'));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByText('last'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
  });
});

function Nested({ outer, inner }: { outer: () => void; inner: () => void }) {
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);
  useDialogFocus(a, true, outer);
  useDialogFocus(b, true, inner);
  return (
    <div ref={a}>
      <button>outer</button>
      <div ref={b}>
        <button>inner</button>
      </div>
    </div>
  );
}

describe('nested dialogs', () => {
  it('only the topmost closes on Escape', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(<Nested outer={outer} inner={inner} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });
});
