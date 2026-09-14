'use client';

import { UserPlus } from 'lucide-react';
import { addModerator } from '@/app/(app)/team/actions';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function ModeratorForm() {
  return (
    <FormDialog
      trigger={
        <Button>
          <UserPlus />
          Add moderator
        </Button>
      }
      title="Add moderator"
      description="They’ll see Orders and Shipments, and only the orders assigned to them."
      action={addModerator}
      submitLabel="Add moderator"
      success={(state) => (state.status === 'saved' && state.message) || 'Moderator added.'}
    >
      <Field>
        <FieldLabel htmlFor="mod-name">Name</FieldLabel>
        <Input id="mod-name" name="name" dir="auto" placeholder="e.g. Aya" autoFocus required />
      </Field>
      <Field>
        <FieldLabel htmlFor="mod-email">Email</FieldLabel>
        <Input id="mod-email" name="email" type="email" placeholder="aya@prime.com" required />
      </Field>
      <Field>
        <FieldLabel htmlFor="mod-password">Password</FieldLabel>
        <Input id="mod-password" name="password" type="text" placeholder="At least 6 characters" required minLength={6} />
        <FieldDescription>Share it with them — they sign in with it directly.</FieldDescription>
      </Field>
    </FormDialog>
  );
}
