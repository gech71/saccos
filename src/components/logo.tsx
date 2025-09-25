
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  logo,
  saccoName,
  isCircular = false,
}: {
  className?: string;
  logo?: string | null;
  saccoName?: string | null;
  isCircular?: boolean;
}) {
  const isBase64 = logo && logo.startsWith('data:image');
  
  return (
    <Link
      href="/"
      className={cn("flex flex-col items-center gap-2 text-xl font-bold text-primary group", className)}
    >
      <Image
        src={
          logo ||
          'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh'
        }
        alt={`${saccoName || 'Sacco'} Logo`}
        width={isCircular ? 64 : 32}
        height={isCircular ? 64 : 32}
        className={cn(
            "transition-transform duration-300 group-hover:rotate-12",
            isCircular ? "rounded-full h-16 w-16 object-cover" : "rounded-md"
        )}
        unoptimized={isBase64}
      />
      <span className="font-headline text-2xl">{saccoName || 'NIB Saccos'}</span>
    </Link>
  );
}
