
import { Footer } from '@/components/website/footer';
import { Navbar } from '@/components/website/navbar';
import type { WebsiteContent, SocialMediaLink } from '@prisma/client';

export default function WebsiteLayout({
  children,
  content,
}: {
  children: React.ReactNode;
  content: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar content={content} />
      <main className="flex-1">{children}</main>
      <Footer content={content} />
    </div>
  );
}
