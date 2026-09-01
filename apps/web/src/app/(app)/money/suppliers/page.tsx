import Link from 'next/link';
import { SupplierForm } from '@/components/supplier-form';
import { PageCard, Panel, Screen, Scroller } from '@/components/shell';
import { getSuppliers } from '@/lib/api';
import { date, money } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export default async function SuppliersPage() {
  await requireAdmin();
  const suppliers = await getSuppliers();
  const owed = suppliers.reduce((n, s) => n + Number(s.balance), 0);

  return (
    <Screen>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <PageCard
          title="Suppliers"
          description={
            owed > 0
              ? `${money(owed)} owed across ${suppliers.filter((s) => Number(s.balance) > 0).length} supplier(s).`
              : 'Everyone we buy stock from.'
          }
          actions={<SupplierForm />}
        />

        <Panel>
          <Scroller>
            {suppliers.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted-foreground">
                No suppliers yet. Add one to record a purchase.
              </p>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
                  <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">Supplier</th>
                    <th className="px-4 py-2.5 text-left font-medium">Phone</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance owed</th>
                    <th className="px-4 py-2.5 text-right font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr
                      key={s.id}
                      className="group relative h-11 border-b border-border/60 last:border-b-0 hover:bg-accent/40"
                    >
                      <td className="px-4">
                        <Link
                          href={`/money/suppliers/${s.id}`}
                          dir="rtl"
                          className="font-medium after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                        >
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 tabular-nums text-muted-foreground">
                        {s.phone ?? <span className="opacity-40">—</span>}
                      </td>
                      <td
                        className={cn(
                          'px-4 text-right font-medium tabular-nums',
                          Number(s.balance) > 0 ? 'text-warning' : 'text-muted-foreground',
                        )}
                      >
                        {Number(s.balance) > 0 ? money(s.balance) : '—'}
                      </td>
                      <td className="px-4 text-right whitespace-nowrap text-muted-foreground">
                        {date(s.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Scroller>
        </Panel>
      </div>
    </Screen>
  );
}
