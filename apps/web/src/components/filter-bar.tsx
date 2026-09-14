'use client';

import { SearchIcon, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { DateRangePicker } from '@/components/date-picker';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  /** Secondary text in the menu only — e.g. an account's Arabic name. */
  hint?: string;
}

export type FilterSpec =
  | { kind: 'select'; param: string; all: string; options: FilterOption[] }
  | { kind: 'toggle'; param: string; value: string; label: string }
  | { kind: 'dates'; from: string; to: string };

/** Radix Select can't hold an empty value, so "no filter" gets a sentinel. */
const ALL = '__all__';

/**
 * Every list screen's filter row. Filters live in the URL — a filtered view is
 * shareable, the back button works, and the list itself stays a server
 * component. Any change drops the page number, since it can't survive a new
 * result set.
 */
export function FilterBar({
  search,
  filters = [],
  children,
}: {
  search?: { param: string; placeholder: string };
  filters?: FilterSpec[];
  /** Right-aligned actions that belong to the list (sync, export…). */
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    next.delete('selected');
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const keys = [
    ...(search ? [search.param] : []),
    ...filters.flatMap((f) => (f.kind === 'dates' ? [f.from, f.to] : [f.param])),
  ];
  const active = keys.some((k) => params.get(k));

  return (
    <div
      aria-busy={pending}
      className={cn('flex flex-wrap items-center gap-2 transition-opacity', pending && 'opacity-60')}
    >
      {search ? (
        <SearchField
          initial={params.get(search.param) ?? ''}
          placeholder={search.placeholder}
          onSearch={(value) => update({ [search.param]: value || null })}
        />
      ) : null}

      {filters.map((f) => {
        if (f.kind === 'toggle') {
          const on = params.get(f.param) === f.value;
          return (
            <Toggle
              key={f.param}
              variant="outline"
              pressed={on}
              onPressedChange={(p) => update({ [f.param]: p ? f.value : null })}
            >
              {f.label}
            </Toggle>
          );
        }
        if (f.kind === 'dates') {
          return (
            <DateRangePicker
              key={`${f.from}-${f.to}`}
              from={params.get(f.from)}
              to={params.get(f.to)}
              onChange={(from, to) => update({ [f.from]: from, [f.to]: to })}
            />
          );
        }
        const value = params.get(f.param);
        const chosen = f.options.find((o) => o.value === value);
        return (
          <Select
            key={f.param}
            value={chosen ? chosen.value : ALL}
            onValueChange={(v) => update({ [f.param]: v === ALL ? null : v })}
          >
            <SelectTrigger
              className={cn(
                'min-w-36',
                chosen ? 'border-primary/30 bg-primary/5 font-medium text-primary' : 'text-muted-foreground',
              )}
            >
              <SelectValue>{chosen ? chosen.label : f.all}</SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectItem value={ALL}>{f.all}</SelectItem>
              <SelectSeparator />
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                  {o.hint ? (
                    <bdi className="ms-auto ps-3 text-muted-foreground">{o.hint}</bdi>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}

      {active ? (
        <Button
          variant="ghost"
          onClick={() => update(Object.fromEntries(keys.map((k) => [k, null])))}
          className="text-muted-foreground"
        >
          <X />
          Reset
        </Button>
      ) : null}

      {children ? <div className="ms-auto flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

/**
 * Typed locally, pushed to the URL after a pause — never a navigation per
 * keystroke. `pushed` remembers what this field last sent, so the URL echoing
 * it back doesn't clobber characters typed since; only an outside change (a
 * Reset) overwrites the field.
 */
function SearchField({
  initial,
  placeholder,
  onSearch,
}: {
  initial: string;
  placeholder: string;
  onSearch: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const pushed = useRef(initial);

  useEffect(() => {
    if (initial === pushed.current) return;
    pushed.current = initial;
    setValue(initial);
  }, [initial]);

  useEffect(() => {
    const next = value.trim();
    if (next === pushed.current) return;
    const t = setTimeout(() => {
      pushed.current = next;
      onSearch(next);
    }, 300);
    return () => clearTimeout(t);
    // onSearch is a fresh closure each render; the typed value is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <InputGroup className="w-full sm:w-64">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setValue('')}>
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
