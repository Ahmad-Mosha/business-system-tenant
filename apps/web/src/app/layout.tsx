import type { Metadata } from 'next';
import { DM_Sans, Geist_Mono, IBM_Plex_Sans_Arabic, Space_Grotesk } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { ThemeProvider } from '@/components/theme-provider';
import { DirectionProvider } from '@/components/ui/direction';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { directionOf, languageOf } from '@/i18n/config';
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return { title: t('name'), description: t('description') };
}

/**
 * The language (a cookie, see i18n/request.ts) decides `lang` and `dir` here,
 * once. Everything below reads direction from the document and from Radix's
 * DirectionProvider — no screen checks the language to lay itself out.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = directionOf(locale);
  return (
    <html
      lang={languageOf(locale)}
      dir={dir}
      suppressHydrationWarning
      className={`${sans.variable} ${heading.variable} ${mono.variable} ${arabic.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-background text-foreground">
        <NextIntlClientProvider>
          <DirectionProvider dir={dir}>
            <ThemeProvider>
              <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
              {/* Top so a toast never sits on a bottom-right action bar. */}
              <Toaster position="top-center" dir={dir} />
            </ThemeProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
