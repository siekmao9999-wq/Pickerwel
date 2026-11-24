import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const nextConfig = (phase: string): NextConfig => ({
  // Isolate next dev from production `next build` so dev never overwrites .next/server during builds.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type-checking is verified separately via `tsc --noEmit` so deployment builds stay fast and within container RAM.
    ignoreBuildErrors: true,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  outputFileTracingExcludes: {
    // Skip slow @vercel/nft AST parsing across node_modules during next-server tracing;
    // the minimal production runtime packages are included directly via fast glob below.
    'next-server': ['**/node_modules/**'],
  },
  outputFileTracingIncludes: {
    // Use a single exact route key (picomatch runs with contains:true, so '/' would match every route 20+ times).
    '/api/github/logout': [
      './node_modules/next/package.json',
      './node_modules/next/dist/server/**/*',
      './node_modules/next/dist/shared/**/*',
      './node_modules/next/dist/lib/**/*',
      './node_modules/next/dist/client/**/*',
      './node_modules/next/dist/pages/**/*',
      './node_modules/next/dist/build/**/*',
      './node_modules/next/dist/next-devtools/**/*',
      './node_modules/next/dist/experimental/**/*',
      './node_modules/next/dist/export/**/*',
      './node_modules/next/dist/cli/**/*',
      './node_modules/next/dist/styled-jsx/**/*',
      './node_modules/next/dist/telemetry/**/*',
      './node_modules/next/dist/trace/**/*',
      './node_modules/next/dist/compiled/next-server/*.prod.js',
      './node_modules/next/dist/compiled/!(next-server|webpack|babel|babel-packages|amphtml-validator|react-dom-experimental|react-server-dom-turbopack*|react-server-dom-webpack-experimental|next-devtools|@vercel)/**/*',
      './node_modules/react/**/*',
      './node_modules/react-dom/**/*',
      './node_modules/styled-jsx/**/*',
      './node_modules/@swc/helpers/**/*',
      './node_modules/@next/env/**/*',
      './node_modules/@opentelemetry/api/**/*',
      './node_modules/client-only/**/*',
      './node_modules/detect-libc/**/*',
      './node_modules/source-map-js/**/*',
      './node_modules/sharp/**/*',
      './node_modules/@img/**/*',
    ],
  },
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion/react', 'firebase/auth', 'firebase/firestore'],
    webpackBuildWorker: false,
    preloadEntriesOnStart: false,
    devtoolSegmentExplorer: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Prevent dev webpack cache from filling container RAM; HMR is disabled anyway.
      config.cache = false;
    }
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
});

export default nextConfig;
