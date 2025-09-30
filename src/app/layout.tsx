
import React from "react";
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/auth-context';
import { getWebsiteContent } from '@/lib/website-actions';
import { headers } from 'next/headers';



export async function generateMetadata(): Promise<Metadata> {
  const content = await getWebsiteContent();
  const saccoName = content?.saccoName || 'AcademInvest';
  return {
    title: saccoName,
    description: `Savings and Credit Management for ${saccoName}`,
    icons: {
      icon: content?.logo || 'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh',
    }
  };
}

function hexToHsl(hex: string): string | null {
  if (!hex || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
    return null;
  }

  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = await getWebsiteContent();
  const primaryHsl = content?.primary ? hexToHsl(content.primary) : null;
  const accentHsl = content?.accent ? hexToHsl(content.accent) : null;
  
  // Clone children to pass props
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      // @ts-ignore
      return React.cloneElement(child, { content });
    }
    return child;
  });

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
                ${primaryHsl ? `--primary: ${primaryHsl};` : ''}
                ${accentHsl ? `--accent: ${accentHsl};` : ''}
              }
            `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          {childrenWithProps}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
