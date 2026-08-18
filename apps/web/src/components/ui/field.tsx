'use client';

import { cn } from '@/lib/cn';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

/**
 * Label, control, and error message as one unit, so an error can never end up visually
 * detached from the input it belongs to - and so the association is announced to
 * screen readers rather than only implied by position.
 */
export function Field({ label, hint, error, className, id, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink',
          'placeholder:text-ink-3',
          'transition-colors duration-150',
          error ? 'border-bad' : 'border-line hover:border-ink-3',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-bad">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}
