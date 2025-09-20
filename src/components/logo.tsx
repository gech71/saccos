
import Image from 'next/image';
import Link from 'next/link';

export function Logo({
  className,
  logoUrl,
}: {
  className?: string;
  logoUrl?: string | null;
}) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2 text-xl font-bold text-primary group ${className}`}
    >
      <Image
        src={
          logoUrl ||
          'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh'
        }
        alt="NIB Saccos Logo"
        width={32}
        height={32}
        className="rounded-md transition-transform duration-300 group-hover:rotate-12"
      />
      <span className="font-headline">NIB Saccos</span>
    </Link>
  );
}
