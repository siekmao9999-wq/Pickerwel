import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Pickerwel — កម្មវិធីបង្វិលកង',
    short_name: 'Pickerwel',
    description:
      'កម្មវិធីបង្វិលកងស្វែងរកជម្រើស និងម៉ោងកំណត់ Stopwatch ដែលអាចប្រើប្រាស់បានទាំង Online និង Offline។',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#3B82F6',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
