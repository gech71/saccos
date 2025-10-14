
import { DynamicTheme } from '@/components/DynamicTheme';
import { AuthProvider } from '@/contexts/auth-context';
import { getWebsiteContent } from '@/lib/website-actions';
import type { WebsiteContent, SocialMediaLink } from '@prisma/client';

export default async function MiniappLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = (await getWebsiteContent()) as (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null;
  return (
    <AuthProvider initialContent={content}>
      <DynamicTheme />
      {children}
    </AuthProvider>
  );
}
