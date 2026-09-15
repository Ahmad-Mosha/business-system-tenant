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

import { requireAdmin } from '@/lib/session';
import { getTranslations } from 'next-intl/server';
import { getFormat } from '@/i18n/get-format';

export default async function ImportsPage() {
  const [f, t, tr] = await Promise.all([getFormat(), getTranslations('noon.imports'), getTranslations()]);
  await requireAdmin();
  const imports = await getImports();

  return (
    <Page>
      <PageHeader title={tr('nav.items.imports')} description={t('description')} />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{t('upload')}</CardTitle>
          <CardDescription>{t('uploadHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>

      <TablePanel
        minWidth="56rem"
        footer={
          <TableCount>
            {tr('nouns.imports', { count: imports.length })}
          </TableCount>
        }
      >
        {imports.length === 0 ? (
          <TableEmpty icon={Upload} title={t('empty')} description={t('emptyHint')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">{t('columns.file')}</TableHead>
                <TableHead>{t('columns.period')}</TableHead>
                <TableHead className="text-end">{t('columns.rows')}</TableHead>
                <TableHead className="text-end">{t('columns.new')}</TableHead>
                <TableHead className="text-end">{t('columns.skipped')}</TableHead>
                <TableHead className="text-end">{t('columns.unmapped')}</TableHead>
                <TableHead className="text-end">{t('columns.imported')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="max-w-0">
                    <span className="block truncate font-medium" title={i.filename}>
                      <bdi>{i.filename}</bdi>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tr('common.dateRange', { from: f.date(i.periodStart), to: f.date(i.periodEnd) })}
                  </TableCell>
                  <TableCell className="num text-end">{i.rowsInFile}</TableCell>
                  <TableCell className="num text-end font-medium">{i.rowsInserted}</TableCell>
                  <TableCell className="num text-end text-muted-foreground">{i.rowsSkipped || '—'}</TableCell>
                  <TableCell className="num text-end">
                    {i.unmappedListings ? (
                      <span className="text-warning">{i.unmappedListings}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground">{f.dateTime(i.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
