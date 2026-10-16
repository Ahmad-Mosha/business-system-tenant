'use client';

import { Boxes, ReceiptText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Tabs } from 'radix-ui';
import type { ReactNode } from 'react';
import { directionOf } from '@/i18n/config';
import styles from './inventory.module.css';

/** Only the presentation changes; both views share the same filtered product set. */
export function InventoryViews({
  heading,
  filters,
  quantities,
  costs,
}: {
  heading: ReactNode;
  filters: ReactNode;
  quantities: ReactNode;
  costs: ReactNode;
}) {
  const t = useTranslations('inventory.preview');
  const locale = useLocale();
  return (
    <Tabs.Root defaultValue="quantities" dir={directionOf(locale)} className={styles.workspace}>
      <div className={styles.listHeader}>
        {heading}
        <Tabs.List aria-label={t('viewLabel')} className={styles.viewSwitch}>
          <Tabs.Trigger value="quantities" className={styles.viewTrigger}>
            <Boxes aria-hidden />{t('quantitiesView')}
          </Tabs.Trigger>
          <Tabs.Trigger value="costs" className={styles.viewTrigger}>
            <ReceiptText aria-hidden />{t('costsView')}
          </Tabs.Trigger>
        </Tabs.List>
      </div>
      <div className={styles.filters}>{filters}</div>
      <Tabs.Content value="quantities" className={styles.viewContent}>{quantities}</Tabs.Content>
      <Tabs.Content value="costs" className={styles.viewContent}>{costs}</Tabs.Content>
    </Tabs.Root>
  );
}
