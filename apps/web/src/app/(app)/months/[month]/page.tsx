import { redirect } from 'next/navigation';

/** A month is now a period on noon's overview; old links land on it. */
export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  redirect(/^\d{4}-\d{2}$/.test(month) ? `/?month=${month}` : '/');
}
