import { Upload } from 'lucide-react';
import { ImportForm } from '@/components/import-form';
import { Page, PageHeader } from '@/components/page';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { requireAdmin } from '@/lib/session';

export default async function ImportsPage() {
  await requireAdmin();
  const imports = await getImports();

  return (
    <Page>
      <PageHeader title="Imports" description="noon settlement exports — how noon’s figures get in." />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Upload a report</CardTitle>
          <CardDescription>Export the settlement report from the noon portal as CSV and drop it here.</CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>

      <TablePanel
        footer={
          <TableCount>
            <span className="num font-medium text-foreground">{imports.length}</span>{' '}
            {imports.length === 1 ? 'import' : 'imports'}
          </TableCount>
        }
      >
        {imports.length === 0 ? (
          <TableEmpty icon={Upload} title="No reports imported yet" description="Your first upload shows up here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell className="text-muted-foreground">
                    {date(i.periodStart)} – {date(i.periodEnd)}
                  </TableCell>
                  <TableCell className="num text-right">{i.rowsInFile}</TableCell>
                  <TableCell className="num text-right font-medium">{i.rowsInserted}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">{i.rowsSkipped || '—'}</TableCell>
                  <TableCell className="num text-right">
                    {i.unmappedListings ? (
                      <span className="text-warning">{i.unmappedListings}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{dateTime(i.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
