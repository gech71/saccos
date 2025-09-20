import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/auth-context';
import { getWebsiteContent } from '@/lib/website-actions';

export async function generateMetadata(): Promise<Metadata> {
  const content = await getWebsiteContent();
  const saccoName = content?.saccoName || 'AcademInvest';
  return {
    title: saccoName,
    description: `Savings and Credit Management for ${saccoName}`,
    icons: {
      icon: content?.logoUrl || 'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh',
    }
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = await getWebsiteContent();
  const primaryColor = content?.primary || '48 96% 53%'; // Fallback to default yellow

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --primary: ${primaryColor};
              }
            `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
