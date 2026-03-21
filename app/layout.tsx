import type { Metadata } from 'next';
import { Figtree, Noto_Sans } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { KeyboardShortcuts } from '@/components/layout/keyboard-shortcuts';
import { Toaster } from 'sonner';
import { I18nProvider } from '@/lib/i18n/provider';

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LabFlow MCP Studio',
  description: 'Multi-tenant AI Agent orchestration platform for laboratory workflows',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${figtree.variable} ${notoSans.variable} font-sans antialiased`}>
        <I18nProvider>
          <KeyboardShortcuts />
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header />
              <main className="flex-1 overflow-auto bg-muted/20 p-6">
                {children}
              </main>
            </div>
          </div>
          <Toaster position="top-right" />
        </I18nProvider>
      </body>
    </html>
  );
}
