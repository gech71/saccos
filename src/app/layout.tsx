import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/auth-context";
import { getWebsiteContent } from "@/lib/website-actions";
import { headers } from "next/headers";

// --- Metadata generation ---
export async function generateMetadata(): Promise<Metadata> {
  const content = await getWebsiteContent();
  const saccoName = content?.saccoName || "SACCO Management System";
  return {
    title: saccoName,
    description: `Savings and Credit Management for ${saccoName}`,
    icons: { icon: content?.logo || "" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = await getWebsiteContent();

  // SAFE nonce extraction
  let nonce = "";
  try {
    const h = await headers();
    nonce = h.get("x-nonce") || "";
  } catch {
    nonce = ""; // fallback during static rendering
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head nonce={nonce}>
        <link rel="preconnect" href="https://fonts.googleapis.com" nonce={nonce} />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
          nonce={nonce}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
          nonce={nonce}
        />
      </head>

      <body className="font-body antialiased">
        <AuthProvider initialContent={content}>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
