import { ImportForm } from '@/components/import-form';
import { PageBody, PageHeader, SectionHeading } from '@/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getImports } from '@/lib/api';
import { date, dateTime } from '@/lib/format';

export default async function ImportsPage() {
  const imports = await getImports();

  return (
    <>
      <PageHeader
        title="Imports"
        description="Upload a noon settlement export to update revenue, fees and products"
      />

      <PageBody>
        <section className="max-w-3xl">
          <ImportForm />
          <p className="mt-4 text-xs text-muted-foreground">
            Uploading the same report twice is safe. Files are recognised by
            content, and rows already held from an overlapping export are skipped.
          </p>
        </section>

        <section>
          <SectionHeading
            title="History"
            hint={imports.length ? `${imports.length} imports` : undefined}
          />
          {imports.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
              No reports imported yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[200px]">File</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead className="text-right">Unmapped</TableHead>
                    <TableHead className="text-right">Imported</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="max-w-0">
                        <span className="block truncate font-medium" title={i.filename}>
                          {i.filename}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {date(i.periodStart)} – {date(i.periodEnd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{i.rowsInFile}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {i.rowsInserted}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {i.rowsSkipped || <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {i.unmappedListings || <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                        {dateTime(i.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </PageBody>
    </>
  );
}
