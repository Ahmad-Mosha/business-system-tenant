import { redirect } from 'next/navigation';

/** Months moved onto noon's overview; old links land there. */
export default function MonthsPage() {
  redirect('/');
}
