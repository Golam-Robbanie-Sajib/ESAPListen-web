import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ConfigProvider } from '@/lib/config-context';
import { ThemeProvider } from '@/lib/theme-context';
import { ToastProvider } from '@/components/Toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ESAPListen - AI Meeting Analysis',
  description: 'Transform meetings into actionable insights',
  icons: {
    icon: '/esapai_logo.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ESAPListen',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#10b981',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ConfigProvider>
                {children}
              </ConfigProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
