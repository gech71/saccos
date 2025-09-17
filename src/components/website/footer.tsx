
import type { WebsiteContent, SocialMediaLink } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '../logo';

export function Footer({ content }: { content: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null }) {
  return (
    <footer className="bg-muted text-muted-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and Sacco Name */}
          <div className="flex flex-col items-center md:items-start">
            <Logo />
            <p className="mt-2 text-sm">
              &copy; {new Date().getFullYear()} {content?.saccoName || 'AcademInvest'}. All rights reserved.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col items-center">
            <h3 className="font-semibold text-foreground mb-4">Quick Links</h3>
            <nav className="flex flex-col gap-2 items-center">
              <Link href="/home" className="hover:text-primary">Home</Link>
              <Link href="/about" className="hover:text-primary">About Us</Link>
              <Link href="/news" className="hover:text-primary">News</Link>
              <Link href="/contact" className="hover:text-primary">Contact</Link>
            </nav>
          </div>

          {/* Social Media */}
          <div className="flex flex-col items-center md:items-end">
            <h3 className="font-semibold text-foreground mb-4">Follow Us</h3>
            <div className="flex gap-4">
              {content?.socialLinks?.map((link) => (
                <Link key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                    <Image
                        src={link.iconUrl}
                        alt={link.name}
                        width={24}
                        height={24}
                        className="h-6 w-6"
                    />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
