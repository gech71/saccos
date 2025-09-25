
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
      className={cn("flex flex-col items-center gap-3 text-xl font-bold text-primary group", className)}
    >
      <Image
        src={
          logo ||
          'https://play-lh.googleusercontent.com/bXqMt9ROsGd0H9vPhib5hG-0NB-EJcAwZy6UUDhvlP-ykE595IMQtzr14R6IRWtJiGTh'
        }
        alt={`${saccoName || 'Sacco'} Logo`}
        width={isCircular ? 80 : 32}
        height={isCircular ? 80 : 32}
        className={cn(
            "transition-transform duration-300 group-hover:rotate-12",
            isCircular ? "rounded-full h-20 w-20 object-cover" : "rounded-md"
        )}
        unoptimized={isBase64}
      />
      <span className="font-headline text-3xl">{saccoName || 'NIB Saccos'}</span>
    </Link>
  );
}
