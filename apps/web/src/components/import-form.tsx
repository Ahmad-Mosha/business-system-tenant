'use client';

import { CheckCircle2, FileText, Info, Loader2, Upload, X } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { uploadReport, type UploadState } from '@/app/(app)/imports/actions';
import { cn } from '@/lib/utils';

const INITIAL: UploadState = { status: 'idle' };

export function ImportForm() {
  const [state, submit, pending] = useActionState(uploadReport, INITIAL);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'done') {
      const { rowsInserted, alreadyImported } = state.result;
      if (alreadyImported) toast.info('This exact file was already imported.');
      else if (rowsInserted === 0) toast.info('Every row was already on record.');
      else toast.success(`Imported ${rowsInserted} new rows.`);
      // Clear the picker so the next upload starts from a clean slate.
      setFile(null);
      formRef.current?.reset();
    }
  }, [state]);

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
    <form ref={formRef} action={submit} className="space-y-4">
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
          'relative rounded-xl border border-dashed px-6 py-10 text-center transition-colors duration-150',
          dragging ? 'border-foreground bg-accent/60' : 'border-border',
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
            <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </span>
            {!pending && (
              <button
                type="button"
                aria-label="Remove file"
                onClick={() => {
                  setFile(null);
                  formRef.current?.reset();
                }}
                className="pointer-events-auto rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="pointer-events-none space-y-1">
            <Upload
              className="mx-auto mb-3 size-5 text-muted-foreground"
              strokeWidth={1.8}
            />
            <p className="text-sm font-medium">Drop a settlement export here</p>
            <p className="text-xs text-muted-foreground">or click to browse · CSV</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!file || pending} className="min-w-[132px]">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Reading…
            </>
          ) : (
            'Import report'
          )}
        </Button>
        {pending && (
          <p className="text-xs text-muted-foreground">
            Parsing, matching products and storing rows.
          </p>
        )}
      </div>

      {state.status === 'done' && <Outcome state={state} />}
    </form>
  );
}

function Outcome({ state }: { state: Extract<UploadState, { status: 'done' }> }) {
  const r = state.result;
  const nothingNew = r.alreadyImported || r.rowsInserted === 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border border-border duration-200">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        {nothingNew ? (
          <Info className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 text-success" strokeWidth={1.9} />
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{state.filename}</p>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {[
          { label: 'Rows read', value: r.rowsInFile },
          { label: 'New', value: r.rowsInserted },
          { label: 'Already held', value: r.rowsSkipped },
          { label: 'Unmapped SKUs', value: r.unmappedListings },
        ].map((cell) => (
          <div key={cell.label} className="bg-background px-5 py-3.5">
            <dt className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
              {cell.label}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{cell.value}</dd>
          </div>
        ))}
      </dl>

      {nothingNew && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          {r.alreadyImported
            ? 'This exact file had already been imported, so nothing changed.'
            : 'Every row was already on record from an earlier export.'}
        </p>
      )}
    </div>
  );
}
