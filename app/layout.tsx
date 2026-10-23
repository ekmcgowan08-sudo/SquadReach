import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import './globals.css';
import { ServiceWorker } from '@/components/service-worker';
import { PREFS_BOOT_SCRIPT } from '@/lib/prefs-boot';

export const metadata: Metadata = {
  title: { default: 'SquadRise', template: '%s · SquadRise' },
  description: 'Run your student ministry’s season like a league — squads, live points, check-in, huddle and follow-up, from one phone.',
  manifest: '/manifest.webmanifest',
  applicationName: 'SquadRise',
  appleWebApp: { capable: true, title: 'SquadRise', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' }
};

export const viewport: Viewport = {
  themeColor: '#161826',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark light'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <Script id="sr-prefs" strategy="beforeInteractive">
          {PREFS_BOOT_SCRIPT}
        </Script>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
