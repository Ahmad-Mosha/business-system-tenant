import { UserCog } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Amount } from '@/components/amount';
import { MetricCard, MetricGrid } from '@/components/metric-card';
import { ModeratorForm } from '@/components/moderator-form';
import { Page, PageHeader } from '@/components/page';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import type { TeamMember } from '@/lib/api';
import { cn } from '@/lib/utils';

export function TeamScreen({ team }: { team: TeamMember[] }) {
  const t = useTranslations('team');
  const tr = useTranslations();
  const assigned = team.reduce((n, m) => n + m.assigned, 0);
  const delivered = team.reduce((n, m) => n + m.delivered, 0);
  const value = team.reduce((n, m) => n + Number(m.deliveredValue), 0);

  return (
    <Page>
      <PageHeader
        title={tr('nav.items.team')}
        description={t('description')}
        actions={<ModeratorForm />}
      />

      {team.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserCog />
            </EmptyMedia>
            <EmptyTitle>{t('empty')}</EmptyTitle>
            <EmptyDescription>{t('emptyHint')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <ModeratorForm />
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <MetricGrid>
            <MetricCard
              label={t('moderators')}
              value={team.length}
              hint={t('active', { count: team.filter((m) => m.active).length })}
            />
            <MetricCard label={t('assigned')} value={assigned} hint={t('assignedHint')} />
            <MetricCard
              label={t('rate')}
              value={assigned ? `${Math.round((delivered / assigned) * 100)}%` : '—'}
              hint={t('rateHint', { delivered, assigned })}
            />
            <MetricCard label={t('sales')} value={<Amount value={value} />} hint={t('salesHint')} />
          </MetricGrid>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {team.map((m) => (
              <ModeratorCard key={m.id} m={m} />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

function ModeratorCard({ m }: { m: TeamMember }) {
  const t = useTranslations('team');
  return (
    <Card>
      <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
        <Avatar className="row-span-2 size-9">
          <AvatarFallback className="font-heading text-sm font-semibold">
            {m.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <CardTitle className="truncate">
          <bdi>{m.name}</bdi>
        </CardTitle>
        <CardDescription className="truncate">{m.email}</CardDescription>
        {!m.active ? (
          <CardAction>
            <Badge variant="outline">{t('inactive')}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{t('rate')}</span>
            <span className="num text-sm font-semibold">{m.deliveryRate === null ? '—' : `${m.deliveryRate}%`}</span>
          </div>
          <Progress value={m.deliveryRate ?? 0} aria-label={t('rateOf', { name: m.name })} />
        </div>
        <dl className="grid grid-cols-3 border-t pt-3">
          <Kpi label={t('assignedKpi')} value={m.assigned} />
          <Kpi label={t('deliveredKpi')} value={m.delivered} className={m.delivered > 0 ? 'text-success' : undefined} />
          <Kpi label={t('cancelledKpi')} value={m.cancelled} className={m.cancelled > 0 ? 'text-destructive' : undefined} />
        </dl>
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">{t('salesValue')}</span>
          <Amount value={m.deliveredValue} className="text-sm font-semibold" />
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('num mt-0.5 text-lg font-semibold', className)}>{value}</dd>
    </div>
  );
}
