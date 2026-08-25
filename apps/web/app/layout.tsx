import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AI SaaS Boilerplate',
  description: 'Monorepo starter for AI-first products'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-slate-950 text-slate-100">
          <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
