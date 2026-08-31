import type { Metadata } from 'next';
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const geistSans = Geist({ variable: '--font-latin', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

/**
 * Every product and customer name in this system is Arabic. Geist has no
 * Arabic coverage, so without a paired face the browser falls back to whatever
 * the OS supplies — which is how the previous build's Arabic looked wrong.
 * Plex Arabic is listed after Geist in --font-sans, so Latin glyphs come from
 * Geist and Arabic ones fall through to Plex.
 */
const arabic = IBM_Plex_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Prime Market',
  description: 'Operations and commerce platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${arabic.variable} h-full antialiased`}
    >
      {/* The document itself never scrolls. Panes inside the shell do. */}
      <body className="h-full overflow-hidden bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
