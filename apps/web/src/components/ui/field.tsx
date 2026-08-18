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
      <label htmlFor={inputId} className="block text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-10 w-full rounded-md border bg-surface px-3 text-sm text-ink',
          'placeholder:text-ink-faint',
          'transition-colors duration-150',
          error ? 'border-danger' : 'border-rule-strong hover:border-ink-faint',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
