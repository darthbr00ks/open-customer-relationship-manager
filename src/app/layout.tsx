import type { Metadata } from 'next';

import { DensityProvider } from '@/components/density-provider';
import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'open-rm',
  description: 'An open relationship management tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">
        <DensityProvider />
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}
