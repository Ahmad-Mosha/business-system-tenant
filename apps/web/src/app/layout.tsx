import type { Metadata } from 'next';
import { DM_Sans, Geist_Mono, IBM_Plex_Sans_Arabic, Space_Grotesk } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const sans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] });
const heading = Space_Grotesk({ variable: '--font-space-grotesk', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

/**
 * Every product and customer name in this system is Arabic, and neither DM
 * Sans nor Space Grotesk has Arabic glyphs. Plex Arabic follows them in both
 * font stacks (globals.css — which also explains why the stacks name the
 * families directly), so Latin comes from the brand faces and Arabic from Plex.
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
      className={`${sans.variable} ${heading.variable} ${mono.variable} ${arabic.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          {/* Top so a toast never sits on a bottom-right action bar. */}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
