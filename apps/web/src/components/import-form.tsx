'use client';

import { CheckCircle2, FileText, Info, Upload, X } from 'lucide-react';
import { useActionState, useRef, useState } from 'react';
import { toast } from 'sonner';
import { uploadReport, type UploadState } from '@/app/(app)/imports/actions';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, submit, pending] = useActionState<UploadState, FormData>(async (prev, form) => {
    const next = await uploadReport(prev, form);
    if (next.status === 'error') toast.error(next.message);
    if (next.status === 'done') {
      const { rowsInserted, alreadyImported } = next.result;
      if (alreadyImported) toast.info('This exact file was already imported.');
      else if (rowsInserted === 0) toast.info('Every row was already on record.');
      else toast.success(`Imported ${rowsInserted} new rows.`);
      // Clear the picker so the next upload starts from a clean slate.
      setFile(null);
      formRef.current?.reset();
    }
    return next;
  }, { status: 'idle' });

  const choose = (files: FileList | null) => {
    const next = files?.[0];
    if (!next) return;
    if (!next.name.toLowerCase().endsWith('.csv')) {
      toast.error('That is not a CSV file.');
      return;
    }
    setFile(next);
  };

  return (
    <form ref={formRef} action={submit} className="grid gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (pending) return;
          choose(e.dataTransfer.files);
          if (inputRef.current) inputRef.current.files = e.dataTransfer.files;
        }}
        className={cn(
          'relative border border-dashed px-6 py-10 text-center transition-colors duration-150 focus-within:border-ring',
          dragging ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/50',
          pending && 'opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={(e) => choose(e.target.files)}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label="Choose a noon settlement export"
        />
        {file ? (
          <div className="pointer-events-none flex items-center justify-center gap-2.5">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-[13px] font-medium">{file.name}</span>
            <span className="num shrink-0 text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
            {!pending ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remove file"
                onClick={() => {
                  setFile(null);
                  formRef.current?.reset();
                }}
                className="pointer-events-auto relative z-10"
              >
                <X />
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="pointer-events-none grid justify-items-center gap-1">
            <span className="mb-2 flex size-9 items-center justify-center bg-muted">
              <Upload className="size-4 text-muted-foreground" />
            </span>
            <p className="text-[13px] font-medium">Drop a settlement export here</p>
            <p className="text-xs text-muted-foreground">or click to browse · CSV from the noon portal</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!file || pending}>
          {pending ? <Spinner /> : <Upload />}
          {pending ? 'Reading…' : 'Import report'}
        </Button>
        <p className="text-xs text-muted-foreground">
          {pending
            ? 'Parsing, matching products and storing rows.'
            : 'The same report twice is safe — files are recognised by content, and rows already held are skipped.'}
        </p>
      </div>

      {state.status === 'done' ? <Outcome state={state} /> : null}
    </form>
  );
}

function Outcome({ state }: { state: Extract<UploadState, { status: 'done' }> }) {
  const r = state.result;
  const nothingNew = r.alreadyImported || r.rowsInserted === 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 border duration-200">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        {nothingNew ? (
          <Info className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 text-success" />
        )}
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{state.filename}</p>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {[
          { label: 'Rows read', value: r.rowsInFile },
          { label: 'New', value: r.rowsInserted },
          { label: 'Already held', value: r.rowsSkipped },
          { label: 'Unmapped SKUs', value: r.unmappedListings },
        ].map((cell, i) => (
          <div key={cell.label} className={cn('px-4 py-3', i > 0 && 'border-s')}>
            <dt className="text-xs text-muted-foreground">{cell.label}</dt>
            <dd className="num mt-1 text-lg font-semibold">{cell.value}</dd>
          </div>
        ))}
      </dl>
      {nothingNew ? (
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          {r.alreadyImported
            ? 'This exact file had already been imported, so nothing changed.'
            : 'Every row was already on record from an earlier export.'}
        </p>
      ) : null}
    </div>
  );
}
