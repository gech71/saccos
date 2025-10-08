
import { Footer } from '@/components/website/footer';
import { Navbar } from '@/components/website/navbar';
import { getWebsiteContent } from '@/lib/website-actions';
import type { WebsiteContent, SocialMediaLink } from '@prisma/client';

export default async function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = await getWebsiteContent() as (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar content={content} />
      <main className="flex-1">{children}</main>
      <Footer content={content} />
    </div>
  );
}
