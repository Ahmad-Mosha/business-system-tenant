'use client';

import { format, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** `yyyy-MM-dd` ⇄ a local-midnight Date — never through UTC, so no day shifts. */
const toDate = (iso: string | null | undefined) =>
  iso ? parse(iso, 'yyyy-MM-dd', new Date()) : undefined;
const toISO = (d: Date) => format(d, 'yyyy-MM-dd');
const show = (d: Date) => format(d, 'd MMM yyyy');

/**
 * A date field. Posts `yyyy-MM-dd` under `name` like the native input it
 * replaces, so server actions read it unchanged.
 */
export function DatePicker({
  name,
  id,
  value,
  defaultValue,
  onChange,
  disabled,
  placeholder = 'Pick a date',
  className,
  'aria-invalid': invalid,
}: {
  name?: string;
  id?: string;
  /** Controlled value, `yyyy-MM-dd`. */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-invalid'?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(defaultValue ?? '');
  const iso = value ?? inner;
  const date = toDate(iso);

  const pick = (d: Date | undefined) => {
    const next = d ? toISO(d) : '';
    setInner(next);
    onChange?.(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid}
          className={cn(
            'w-full justify-between px-2.5 font-normal',
            !date && 'text-muted-foreground',
            className,
          )}
        >
          <span className="num">{date ? show(date) : placeholder}</span>
          <CalendarIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={pick}
          captionLayout="dropdown"
          autoFocus
        />
      </PopoverContent>
      {name ? <input type="hidden" name={name} value={iso} /> : null}
    </Popover>
  );
}

/**
 * A from–to filter. The first click in a range calendar already makes a
 * one-day range, so changes are held as a draft and applied explicitly —
 * otherwise every range would cost two round trips.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = 'Any date',
}: {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const current = from || to ? { from: toDate(from), to: toDate(to) } : undefined;

  const label = current?.from
    ? current.to && toISO(current.to) !== toISO(current.from)
      ? `${show(current.from)} – ${show(current.to)}`
      : show(current.from)
    : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(current);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'font-normal',
            current ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10' : 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="text-muted-foreground" />
          <span className="num">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={draft}
          defaultMonth={draft?.from}
          onSelect={setDraft}
          autoFocus
        />
        <div className="flex items-center justify-end gap-2 border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null, null);
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            disabled={!draft?.from}
            onClick={() => {
              if (!draft?.from) return;
              onChange(toISO(draft.from), toISO(draft.to ?? draft.from));
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
