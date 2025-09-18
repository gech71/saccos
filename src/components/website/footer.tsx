
import type { WebsiteContent, SocialMediaLink } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '../logo';
import { Mail, MapPin, Phone } from 'lucide-react';

export function Footer({ content }: { content: (WebsiteContent & { socialLinks: SocialMediaLink[] }) | null }) {
  return (
    <footer className="bg-accent text-accent-foreground border-t border-primary/20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Logo and Sacco Name */}
          <div className="md:col-span-1 space-y-4">
            <Logo />
            <p className="text-sm text-accent-foreground/80">
              Your trusted partner in savings and credit for the educational community.
            </p>
             <div className="flex gap-4 pt-2">
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

          {/* Quick Links */}
          <div className="md:col-span-1">
            <h3 className="font-semibold text-accent-foreground mb-4">Quick Links</h3>
            <nav className="flex flex-col gap-2">
              <Link href="/home" className="hover:text-primary">Home</Link>
              <Link href="/about" className="hover:text-primary">About Us</Link>
              <Link href="/news" className="hover:text-primary">News</Link>
              <Link href="/contact" className="hover:text-primary">Contact</Link>
            </nav>
          </div>
          
          {/* Contact Info */}
           <div className="md:col-span-2">
             <h3 className="font-semibold text-accent-foreground mb-4">Contact Us</h3>
             <div className="space-y-4">
                <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 mt-1 flex-shrink-0" />
                    <span>{content?.address || '123 Main Street, Addis Ababa, Ethiopia'}</span>
                </div>
                 <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 mt-1 flex-shrink-0" />
                    <span>{content?.phone || '+251-911-123-456'}</span>
                </div>
                 <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 mt-1 flex-shrink-0" />
                    <a href={`mailto:${content?.email || 'contact@academinvest.com'}`} className="hover:text-primary">
                        {content?.email || 'contact@academinvest.com'}
                    </a>
                </div>
             </div>
          </div>

        </div>
         <div className="mt-8 pt-8 border-t border-accent-foreground/20 text-center text-sm text-accent-foreground/60">
            <p>&copy; {new Date().getFullYear()} {content?.saccoName || 'AcademInvest'}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
