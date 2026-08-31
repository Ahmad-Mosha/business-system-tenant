import type { Metadata } from 'next';
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

// Product names are Arabic and stay Arabic. Loaded here so they render in a
// real Arabic face rather than an OS fallback.
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
  variable: '--font-arabic-sans',
});

export const metadata: Metadata = {
  title: 'Prime Market',
  description: 'Inventory, orders, money and channels — one reconciled source of truth.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${arabic.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
