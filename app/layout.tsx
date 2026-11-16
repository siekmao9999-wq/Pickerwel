import type { Metadata, Viewport } from 'next';
import { Kantumruy_Pro, Siemreap, Poppins } from 'next/font/google';
import './globals.css';
import { PickerwelProvider } from '@/components/PickerwelProvider';

const kantumruyPro = Kantumruy_Pro({
  subsets: ['khmer', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-kantumruy',
  display: 'swap',
});

const siemreap = Siemreap({
  subsets: ['khmer'],
  weight: ['400'],
  variable: '--font-siemreap',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#3B82F6',
  width: 'device-width',
  initialScale: 1,
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
    <html
      lang="km"
      className={`${kantumruyPro.variable} ${siemreap.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <body
        className="bg-[#F8FAFC] text-slate-900 dark:bg-[#0F172A] dark:text-slate-100 antialiased"
        suppressHydrationWarning
      >
        <PickerwelProvider>{children}</PickerwelProvider>
      </body>
    </html>
  );
}
