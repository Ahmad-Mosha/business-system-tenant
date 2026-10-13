'use client';

import { AlertTriangle, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useRef, useState } from 'react';
import { addProduct, type CreateProductState } from '@/app/(app)/inventory/actions';
import { DraftNotice } from '@/components/draft-notice';
import { Page, PageHeader } from '@/components/page';
import { useDraft } from '@/hooks/use-draft';
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
import { NumberField } from '@/components/number-field';
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
type Listings = Record<(typeof LISTING_CHANNELS)[number], string[]>;

interface ProductFormState {
  name: string;
  category: string;
  sku: string;
  unitCost: string;
  openingStock: string;
  listings: Listings;
}

export function NewProductForm({ draftKey }: { draftKey: string }) {
  const t = useTranslations('product');
  const tr = useTranslations();
  const router = useRouter();
  const [form, setForm] = useState<ProductFormState>(() => ({
    name: '',
    category: '',
    sku: '',
    unitCost: '',
    openingStock: '0',
    listings: Object.fromEntries(LISTING_CHANNELS.map((c) => [c, ['']])) as Listings,
  }));
  const [initialForm] = useState(form);
  const draft = useDraft({ key: draftKey, value: form, initial: initialForm, apply: setForm });
  const { name, category, unitCost, openingStock } = form;
  const set = <K extends keyof ProductFormState>(key: K) => (value: ProductFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setName = set('name');
  const setCategory = set('category');
  const setUnitCost = set('unitCost');
  const setOpeningStock = set('openingStock');
  // A double click would otherwise add the product — and its opening stock — twice.
  const sending = useRef(false);
  const [state, submit, pending] = useActionState(async (previous: CreateProductState, data: FormData) => {
    try {
      const next = await addProduct(previous, data);
      if (next.status === 'saved') {
        draft.clear();
        router.push(`/inventory/${next.id}`);
      }
      return next;
    } finally {
      sending.current = false;
    }
  }, INITIAL);

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

      <DraftNotice draft={draft} onUndo={setForm} />

      <form
        action={submit}
        onSubmit={(e) => {
          if (sending.current) e.preventDefault();
          else sending.current = true;
        }}
      >
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
                      value={form.sku}
                      onChange={(e) => set('sku')(e.target.value)}
                      placeholder={t('new.optional')}
                      disabled={pending}
                      className="font-mono"
                    />
                  </Field>
                  <Field data-invalid={unitCost.length > 0 && !costOk}>
                    <FieldLabel htmlFor="unitCost">{t('unitCost')}</FieldLabel>
                    <NumberField
                      id="unitCost"
                      name="unitCost"
                      value={unitCost}
                      onValueChange={setUnitCost}
                      group
                      placeholder={t('new.costPlaceholder')}
                      aria-invalid={unitCost.length > 0 && !costOk}
                      disabled={pending}
                      suffix={tr('common.egp')}
                    />
                    {unitCost.length > 0 && !costOk ? (
                      <FieldError>{t('new.costInvalid')}</FieldError>
                    ) : null}
                  </Field>
                  <Field data-invalid={!stockOk}>
                    <FieldLabel htmlFor="openingStock">{t('new.openingStock')}</FieldLabel>
                    <NumberField
                      id="openingStock"
                      name="openingStock"
                      value={openingStock}
                      onValueChange={setOpeningStock}
                      decimals={0}
                      min={0}
                      aria-invalid={!stockOk}
                      disabled={pending}
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
                <div className="grid gap-4">
                  {LISTING_CHANNELS.map((c) => (
                    <ChannelSkuField
                      key={c}
                      channel={c}
                      values={form.listings[c]}
                      onChange={(values) => setForm((f) => ({ ...f, listings: { ...f.listings, [c]: values } }))}
                      pending={pending}
                    />
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
            <p className="me-auto text-xs text-muted-foreground">{tr('drafts.autosaved')}</p>
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

/** A channel's SKU inputs — one to start, more via "+". Each row submits under the same name (`formData.getAll`). */
function ChannelSkuField({
  channel,
  values,
  onChange,
  pending,
}: {
  channel: (typeof LISTING_CHANNELS)[number];
  values: string[];
  onChange: (values: string[]) => void;
  pending: boolean;
}) {
  const t = useTranslations('product');
  const tr = useTranslations();

  return (
    <Field orientation="horizontal">
      <FieldLabel className="w-20 shrink-0 pt-2 font-normal text-muted-foreground">
        {tr(`enums.channel.${channel}`)}
      </FieldLabel>
      <div className="grid flex-1 gap-2">
        {values.map((value, i) => (
          <div key={i} className="flex gap-2">
            <Input
              name={`sku_${channel}`}
              value={value}
              onChange={(e) => onChange(values.map((v, j) => (j === i ? e.target.value : v)))}
              placeholder={t(`channelSku.${channel}.placeholder`)}
              dir="ltr"
              disabled={pending}
              className="font-mono"
            />
            {values.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={pending}
                aria-label={tr('common.cancel')}
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                className="shrink-0 text-muted-foreground"
              >
                <X />
              </Button>
            ) : null}
            {i === values.length - 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={t('listings.addAnother')}
                onClick={() => onChange([...values, ''])}
                className="shrink-0 text-muted-foreground"
              >
                <Plus />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </Field>
  );
}
