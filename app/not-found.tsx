import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center space-y-5 shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <Compass className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white text-balance">
            រកមិនឃើញទំព័រនេះទេ
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            តំណភ្ជាប់នេះប្រហែលជាមិនត្រឹមត្រូវ ឬត្រូវបានផ្លាស់ប្តូរ។ សូមត្រឡប់ទៅទំព័រដើមវិញ។
          </p>
        </div>
        <div className="pt-1">
          <Link
            href="/"
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>ត្រឡប់ទៅទំព័រដើម</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
