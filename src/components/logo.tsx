
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
      className={cn("flex items-center gap-2 text-xl font-bold text-primary group", className)}
    >
      <Image
        src={
          logo || '/images/logo.png'
        }
        alt={`${saccoName || 'Sacco'} Logo`}
        width={32}
        height={32}
        className={cn(
            "transition-transform duration-300 group-hover:rotate-12",
            isCircular ? "rounded-full h-20 w-20 object-cover" : "rounded-md"
        )}
        unoptimized={isBase64}
      />
      <span className="font-headline">{saccoName || 'NIB Saccos'}</span>
    </Link>
  );
}
