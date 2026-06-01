import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NotificationCenter from '../components/notifications/NotificationCenter';
import { Toaster } from 'sonner';
import AuthProvider from '../components/layout/AuthProvider';
import GlobalQuickControls from '../components/layout/GlobalQuickControls';
import { auth } from '../lib/auth/auth';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const initDocumentStateScript = `(function(){try{var lang='en';var rawLang=window.localStorage.getItem('language-store');if(rawLang){var parsedLang=JSON.parse(rawLang);if(parsedLang&&parsedLang.state&&parsedLang.state.language==='de'){lang='de';}}document.documentElement.lang=lang;var theme='dark';var rawTheme=window.localStorage.getItem('zstream-theme');if(rawTheme){var parsedTheme=JSON.parse(rawTheme);if(parsedTheme&&parsedTheme.state&&(parsedTheme.state.theme==='light'||parsedTheme.state.theme==='dark')){theme=parsedTheme.state.theme;}}document.documentElement.setAttribute('data-theme',theme);}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: 'Zmeetings',
    template: '%s | Zmeetings',
  },
  description: 'AI-powered carbon-neutral streaming platform. Watch unlimited music, videos, shorts, sports and gaming while saving the planet.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Zmeetings',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#00E5BA',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initDocumentStateScript }} />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} ${inter.variable} bg-dark-base font-sans antialiased`}>
        <AuthProvider session={session}>
          <Toaster position="top-right" richColors closeButton />
          <GlobalQuickControls />
          <main id="main-content">{children}</main>
          <NotificationCenter />
        </AuthProvider>
      </body>
    </html>
  );
}
