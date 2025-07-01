import Image from 'next/image';
import Link from 'next/link';

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 text-xl font-bold text-primary ${className}`}>
      <Image
        src="https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh"
        alt="Saccos Logo"
        width={32}
        height={32}
        className="rounded-md"
      />
      <span className="font-headline">Saccos</span>
    </Link>
  );
}
