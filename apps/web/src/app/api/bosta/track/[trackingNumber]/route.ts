import { NextResponse } from 'next/server';
import { authHeaders } from '@/lib/session';

const API = process.env.API_URL ?? 'http://localhost:3001';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trackingNumber: string }> },
) {
  const { trackingNumber } = await params;
  if (!trackingNumber) {
    return NextResponse.json({ message: 'Tracking number is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${API}/bosta/track/${encodeURIComponent(trackingNumber)}`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Tracking failed' }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 },
    );
  }
}
