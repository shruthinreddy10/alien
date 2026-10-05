import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinTrack — Secure Personal Finance & AI Assistant',
  description: 'Enterprise-grade personal finance management with strict row-level authorization, integer cents arithmetic, AES-256-GCM encrypted key vault, and tamper-evident audit logging.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090D16] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
