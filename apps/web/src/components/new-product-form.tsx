'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { addProduct, type CreateProductState } from '@/app/(app)/inventory/actions';
import { Page, PageHeader } from '@/components/page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LISTING_CHANNELS } from '@/components/channel-listings';
import { CATEGORIES } from '@/lib/categories';

const INITIAL: CreateProductState = { status: 'idle' };

/** Mirrors MONEY on the API — `120`, `120.5` or `120.50`. */
const MONEY = /^\d+(\.\d{1,2})?$/;

/**
 * Every rule here mirrors CatalogService.createProduct — checked as it's
 * typed, not after a round trip that comes back with the same message.
 */
export function NewProductForm() {
  const t = useTranslations('product');
  const tr = useTranslations();
  const [state, submit, pending] = useActionState(addProduct, INITIAL);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [openingStock, setOpeningStock] = useState('0');

  const nameOk = name.trim().length > 0;
  const costOk = unitCost.trim() === '' || MONEY.test(unitCost.trim());
  const stockOk = /^\d+$/.test(openingStock.trim() || '0');
  const touched = name.length > 0;
  const ready = nameOk && costOk && stockOk;

  return (
    <Page width="narrow">
      <PageHeader
        back={{ href: '/inventory', label: t('back') }}
        title={tr('inventory.add')}
        description={t('new.description')}
      />

      <form action={submit}>
        <Card>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>{t('new.details')}</FieldLegend>
                <Field data-invalid={touched && !nameOk}>
                  <FieldLabel htmlFor="name">{t('name')}</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    dir="auto"
                    required
                    autoFocus
                    placeholder={t('new.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={touched && !nameOk}
                    disabled={pending}
                  />
                  {touched && !nameOk ? <FieldError>{t('nameRequired')}</FieldError> : null}
                </Field>
                <Field>
                  <FieldLabel>{t('category')}</FieldLabel>
                  <input type="hidden" name="category" value={category} />
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    spacing={0}
                    value={category}
                    onValueChange={setCategory}
                    disabled={pending}
                    aria-label={t('category')}
                    className="flex-wrap"
                  >
                    {CATEGORIES.map((c) => (
                      <ToggleGroupItem key={c} value={c}>
                        {tr(`enums.category.${c}`)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FieldDescription>{t('new.categoryHint')}</FieldDescription>
                </Field>
              </FieldSet>

              <FieldSeparator />

              <FieldSet>
                <FieldLegend>{t('new.costAndStock')}</FieldLegend>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="sku">{t('new.ourSku')}</FieldLabel>
                    <Input
                      id="sku"
                      name="sku"
                      placeholder={t('new.optional')}
                      disabled={pending}
                      className="font-mono"
                    />
                  </Field>
                  <Field data-invalid={unitCost.length > 0 && !costOk}>
                    <FieldLabel htmlFor="unitCost">{t('unitCost')}</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="unitCost"
                        name="unitCost"
                        inputMode="decimal"
                        value={unitCost}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setUnitCost(e.target.value)}
                        placeholder={t('new.costPlaceholder')}
                        aria-invalid={unitCost.length > 0 && !costOk}
                        disabled={pending}
                        className="num"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>{tr('common.egp')}</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    {unitCost.length > 0 && !costOk ? (
                      <FieldError>{t('new.costInvalid')}</FieldError>
                    ) : null}
                  </Field>
                  <Field data-invalid={!stockOk}>
                    <FieldLabel htmlFor="openingStock">{t('new.openingStock')}</FieldLabel>
                    <Input
                      id="openingStock"
                      name="openingStock"
                      inputMode="numeric"
                      value={openingStock}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setOpeningStock(e.target.value)}
                      aria-invalid={!stockOk}
                      disabled={pending}
                      className="num"
                    />
                    {!stockOk ? <FieldError>{t('new.stockInvalid')}</FieldError> : null}
                  </Field>
                </div>
                <FieldDescription>{t('new.noPrice')}</FieldDescription>
              </FieldSet>

              <FieldSeparator />

              <FieldSet>
                <FieldLegend>{t('new.alsoSoldOn')}</FieldLegend>
                <FieldDescription>{t('new.alsoSoldOnHint')}</FieldDescription>
                <div className="grid gap-3">
                  {LISTING_CHANNELS.map((c) => (
                    <Field key={c} orientation="horizontal">
                      <FieldLabel htmlFor={`sku_${c}`} className="w-20 shrink-0 font-normal text-muted-foreground">
                        {tr(`enums.channel.${c}`)}
                      </FieldLabel>
                      <Input
                        id={`sku_${c}`}
                        name={`sku_${c}`}
                        placeholder={t(`channelSku.${c}.placeholder`)}
                        disabled={pending}
                        className="font-mono"
                      />
                    </Field>
                  ))}
                </div>
              </FieldSet>

              {state.status === 'error' ? (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="ghost" asChild>
              <Link href="/inventory">{tr('common.cancel')}</Link>
            </Button>
            <Button type="submit" disabled={!ready || pending}>
              {pending ? <Spinner /> : null}
              {pending ? t('new.adding') : tr('inventory.add')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Page>
  );
}
