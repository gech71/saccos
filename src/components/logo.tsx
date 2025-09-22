
import Image from 'next/image';
import Link from 'next/link';

export function Logo({
  className,
  logo,
  saccoName,
}: {
  className?: string;
  logo?: string | null;
  saccoName?: string | null;
}) {
  const isBase64 = logo && logo.startsWith('data:image');
  
  return (
    <Link
      href="/"
      className={`flex items-center gap-2 text-xl font-bold text-primary group ${className}`}
    >
      <Image
        src={
          logo ||
          'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh'
        }
        alt={`${saccoName || 'Sacco'} Logo`}
        width={32}
        height={32}
        className="rounded-md transition-transform duration-300 group-hover:rotate-12"
        unoptimized={isBase64}
      />
      <span className="font-headline">{saccoName || 'NIB Saccos'}</span>
    </Link>
  );
}
