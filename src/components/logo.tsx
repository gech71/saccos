
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { School } from 'lucide-react';

export function Logo({
  className,
  logo,
  saccoName,
  isCircular = false,
  hideName = false,
  sizeClass,
  sizePx,
}: {
  className?: string;
  logo?: string | null;
  saccoName?: string | null;
  isCircular?: boolean;
  hideName?: boolean;
  sizeClass?: string;
  sizePx?: number;
}) {
  const isBase64 = Boolean(logo && logo.startsWith('data:image'));
  const px = sizePx || (sizeClass?.includes('h-28') ? 112 : 32);
  
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 text-xl font-bold text-primary group", className)}
    >
        {logo ? (
             <Image
                src={logo}
                alt={`${saccoName || 'SACCO'} Logo`}
                width={px}
                height={px}
                quality={90}
                className={cn(
                    "transition-transform duration-300 group-hover:rotate-6 object-cover",
                    isCircular ? 'rounded-full' : 'rounded-md',
                    sizeClass || 'h-8 w-8',
                    isCircular ? 'ring-2 ring-white/80 shadow-sm' : ''
                )}
                unoptimized={isBase64}
            />
        ) : (
            <div className={cn('bg-primary/10 flex items-center justify-center', isCircular ? 'rounded-full' : 'rounded-md', sizeClass || 'h-8 w-8', isCircular ? 'ring-2 ring-white/80 shadow-sm' : '')} style={{ width: px, height: px }}>
                <School className="h-5 w-5 text-primary"/>
            </div>
        )}
      {!hideName && <span className="font-headline">{saccoName || 'SACCO System'}</span>}
    </Link>
  );
}
