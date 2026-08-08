import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '../providers/LanguageProvider';

export const metadata: Metadata = {
  title: 'SuvarnaLoan ERP - Enterprise Gold Loan Software',
  description: 'Multi-tenant Gold Loan ERP platform by Humble Goats SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
