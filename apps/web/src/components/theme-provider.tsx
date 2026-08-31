'use client';

import { ThemeProvider as NextThemes } from 'next-themes';

/**
 * The `.dark` tokens have existed in globals.css since the first build with
 * nothing switching them on. This is that switch.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
