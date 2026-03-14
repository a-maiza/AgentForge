import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'sonner';
import { Providers } from '@/lib/providers';
import './globals.css';

export const metadata = {
  title: 'AgentForge',
  description: 'LLM Governance & Prompt Management Platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <Providers>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                classNames: {
                  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                  error: 'bg-red-50 border-red-200 text-red-800',
                  warning: 'bg-amber-50 border-amber-200 text-amber-800',
                },
                duration: 3000,
              }}
            />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
