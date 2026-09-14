'use client';

import { format, parse } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { arEG } from 'react-day-picker/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { languageOf } from '@/i18n/config';
import { useFormat } from '@/i18n/use-format';
import { cn } from '@/lib/utils';

/** `yyyy-MM-dd` ⇄ a local-midnight Date — never through UTC, so no day shifts. */
const toDate = (iso: string | null | undefined) =>
  iso ? parse(iso, 'yyyy-MM-dd', new Date()) : undefined;
const toISO = (d: Date) => format(d, 'yyyy-MM-dd');

/** Today on the user's clock. `toISOString()` is UTC — between midnight and
 *  3am in Cairo it still says yesterday. */
export const todayISO = () => toISO(new Date());

/** What both pickers say, and how they show a date, in the reader's language. */
function usePickerText() {
  const t = useTranslations();
  const f = useFormat();
  const arabic = languageOf(useLocale()) === 'ar';
  return {
    t,
    show: (d: Date) => f.date(toISO(d)),
    // Arabic month and day names; English keeps the calendar's own.
    calendar: arabic ? { locale: arEG, dir: 'rtl' as const } : {},
  };
}

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
  placeholder,
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
  const { t, show, calendar } = usePickerText();
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
          <span className="num">{date ? show(date) : (placeholder ?? t('filters.pickDate'))}</span>
          <CalendarIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          {...calendar}
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
  placeholder,
}: {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  placeholder?: string;
}) {
  const { t, show, calendar } = usePickerText();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const current = from || to ? { from: toDate(from), to: toDate(to) } : undefined;

  const label = current?.from
    ? current.to && toISO(current.to) !== toISO(current.from)
      ? `${show(current.from)} – ${show(current.to)}`
      : show(current.from)
    : (placeholder ?? t('filters.anyDate'));

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
            current ? 'border-highlight/30 bg-highlight/5 text-highlight hover:bg-highlight/10' : 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="text-muted-foreground" />
          <span className="num">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          {...calendar}
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
            {t('common.clear')}
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
            {t('common.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
