import { Footer } from '@/components/website/footer';
import { Navbar } from '@/components/website/navbar';
import { getWebsiteContent } from '@/lib/website-actions';
import type { WebsiteContent, SocialMediaLink } from '@prisma/client';

// Layouts in app/ are server components by default
export default async function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch content on the server (SSR)
  const content: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null =
    await getWebsiteContent();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar content={content} />
      <main className="flex-1">{children}</main>
      <Footer content={content} />
    </div>
  );
}
