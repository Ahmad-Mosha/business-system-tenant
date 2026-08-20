import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/app-sidebar';
import './globals.css';

// Named to match the `--font-sans` token the theme reads.
const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Prime Market',
  description: 'Operations and commerce platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider delayDuration={200}>
          <div className="flex min-h-svh">
            <AppSidebar />
            {/* pt-14 clears the mobile bar; the sidebar is in flow from lg up. */}
            <main className="min-w-0 flex-1 pt-14 lg:pt-0">{children}</main>
          </div>
        </TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
