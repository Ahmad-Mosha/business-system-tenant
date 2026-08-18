'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  key: string;
  label: string;
  description?: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * A small menu with real keyboard support: arrows move, Enter selects, Escape closes
 * and returns focus to the trigger. Written rather than pulled in so it matches the
 * rest of the design system and carries no extra runtime.
 */
export function DropdownMenu({
  trigger,
  items,
  align = 'end',
  disabled,
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const enabled = items.filter((i) => !i.disabled);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(item: MenuItem) {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((v) => !v);
          setActiveIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            setOpen(true);
            setActiveIndex(0);
          }
        }}
        className="disabled:cursor-not-allowed disabled:opacity-45"
      >
        {trigger}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % enabled.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => (i - 1 + enabled.length) % enabled.length);
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const item = enabled[activeIndex];
              if (item) choose(item);
            }
          }}
          className={cn(
            'absolute z-30 mt-1.5 min-w-[15rem] overflow-hidden rounded-xl border border-line',
            'bg-surface p-1 shadow-lg shadow-black/[0.06]',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => {
            const index = enabled.indexOf(item);
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onMouseEnter={() => index >= 0 && setActiveIndex(index)}
                onClick={() => choose(item)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors',
                  'disabled:cursor-not-allowed disabled:opacity-40',
                  index === activeIndex && !item.disabled ? 'bg-line-soft' : '',
                  item.tone === 'danger' ? 'text-bad' : 'text-ink',
                )}
              >
                <span className="text-[13.5px] font-medium">{item.label}</span>
                {item.description ? (
                  <span className="text-[12px] text-ink-3">{item.description}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
