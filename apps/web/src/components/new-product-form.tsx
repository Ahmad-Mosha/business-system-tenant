'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
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
import { CATEGORIES } from '@/lib/categories';

const INITIAL: CreateProductState = { status: 'idle' };

/** Mirrors MONEY on the API — `120`, `120.5` or `120.50`. */
const MONEY = /^\d+(\.\d{1,2})?$/;

const CHANNELS = [
  { name: 'sku_noon', label: 'noon', placeholder: 'Partner SKU, e.g. CCC-0001' },
  { name: 'sku_amazon', label: 'Amazon', placeholder: 'Seller SKU' },
  { name: 'sku_easyorders', label: 'Website', placeholder: 'Easy Orders product ID' },
] as const;

/**
 * Every rule here mirrors CatalogService.createProduct — checked as it's
 * typed, not after a round trip that comes back with the same message.
 */
export function NewProductForm() {
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
        back={{ href: '/inventory', label: 'Back to inventory' }}
        title="Add product"
        description="Its identity, cost and opening stock. Price is set on each order."
      />

      <form action={submit}>
        <Card>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>Details</FieldLegend>
                <Field data-invalid={touched && !nameOk}>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    dir="auto"
                    required
                    autoFocus
                    placeholder="e.g. اكسجين بلوب 1 لتر مشكل"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={touched && !nameOk}
                    disabled={pending}
                  />
                  {touched && !nameOk ? <FieldError>A product needs a name.</FieldError> : null}
                </Field>
                <Field>
                  <FieldLabel>Category</FieldLabel>
                  <input type="hidden" name="category" value={category} />
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    spacing={0}
                    value={category}
                    onValueChange={setCategory}
                    disabled={pending}
                    aria-label="Category"
                    className="flex-wrap"
                  >
                    {CATEGORIES.map((c) => (
                      <ToggleGroupItem key={c.value} value={c.value}>
                        {c.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FieldDescription>Optional — click again to clear.</FieldDescription>
                </Field>
              </FieldSet>

              <FieldSeparator />

              <FieldSet>
                <FieldLegend>Cost and stock</FieldLegend>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="sku">Our SKU</FieldLabel>
                    <Input
                      id="sku"
                      name="sku"
                      placeholder="Optional"
                      disabled={pending}
                      className="font-mono"
                    />
                  </Field>
                  <Field data-invalid={unitCost.length > 0 && !costOk}>
                    <FieldLabel htmlFor="unitCost">Unit cost</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="unitCost"
                        name="unitCost"
                        inputMode="decimal"
                        value={unitCost}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setUnitCost(e.target.value)}
                        placeholder="What we paid"
                        aria-invalid={unitCost.length > 0 && !costOk}
                        disabled={pending}
                        className="num"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>EGP</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    {unitCost.length > 0 && !costOk ? (
                      <FieldError>An amount like 120 or 120.50.</FieldError>
                    ) : null}
                  </Field>
                  <Field data-invalid={!stockOk}>
                    <FieldLabel htmlFor="openingStock">Opening stock</FieldLabel>
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
                    {!stockOk ? <FieldError>A whole number, 0 or more.</FieldError> : null}
                  </Field>
                </div>
                <FieldDescription>
                  No selling price here — it differs by channel, so it comes from each order. A
                  product carries cost, not price.
                </FieldDescription>
              </FieldSet>

              <FieldSeparator />

              <FieldSet>
                <FieldLegend>Also sold on</FieldLegend>
                <FieldDescription>
                  Optional. The SKU each channel uses — a sale there moves this product’s stock. You
                  can add these later from the product page.
                </FieldDescription>
                <div className="grid gap-3">
                  {CHANNELS.map((c) => (
                    <Field key={c.name} orientation="horizontal">
                      <FieldLabel htmlFor={c.name} className="w-20 shrink-0 font-normal text-muted-foreground">
                        {c.label}
                      </FieldLabel>
                      <Input
                        id={c.name}
                        name={c.name}
                        placeholder={c.placeholder}
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
              <Link href="/inventory">Cancel</Link>
            </Button>
            <Button type="submit" disabled={!ready || pending}>
              {pending ? <Spinner /> : null}
              {pending ? 'Adding' : 'Add product'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Page>
  );
}
