import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PickerwelProvider } from '@/components/PickerwelProvider';
import { PickerwelShell } from '@/components/PickerwelShell';

export const viewport: Viewport = {
  themeColor: '#3B82F6',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Pickerwel — កម្មវិធីបង្វិលកងស្វែងរកជម្រើស',
  description:
    'កម្មវិធីបង្វិលកងស្វែងរកជម្រើសដ៏ទំនើប និងងាយស្រួលប្រើសម្រាប់ថ្នាក់រៀន និងការងារក្រុម។',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Pickerwel',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Pickerwel — កម្មវិធីបង្វិលកងស្វែងរកជម្រើស',
    description:
      'កម្មវិធីបង្វិលកងស្វែងរកជម្រើសដ៏ទំនើប និងងាយស្រួលប្រើសម្រាប់ថ្នាក់រៀន និងការងារក្រុម។',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pickerwel — កម្មវិធីបង្វិលកងស្វែងរកជម្រើស',
    description:
      'កម្មវិធីបង្វិលកងស្វែងរកជម្រើសដ៏ទំនើប និងងាយស្រួលប្រើសម្រាប់ថ្នាក់រៀន និងការងារក្រុម។',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="km" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@500;600;700&family=Poppins:wght@400;500;600;700&family=Siemreap&display=swap"
        />
      </head>
      <body
        className="bg-[#F8FAFC] text-slate-900 dark:bg-[#0F172A] dark:text-slate-100 antialiased"
        suppressHydrationWarning
      >
        <PickerwelProvider>
          <PickerwelShell>{children}</PickerwelShell>
        </PickerwelProvider>
      </body>
    </html>
  );
}
