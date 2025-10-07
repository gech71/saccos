
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
}: {
  className?: string;
  logo?: string | null;
  saccoName?: string | null;
  isCircular?: boolean;
  hideName?: boolean;
}) {
  const isBase64 = logo && logo.startsWith('data:image');
  
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 text-xl font-bold text-primary group", className)}
    >
        {logo ? (
             <Image
                src={logo}
                alt={`${saccoName || 'SACCO'} Logo`}
                width={32}
                height={32}
                className={cn(
                    "transition-transform duration-300 group-hover:rotate-12",
                    isCircular ? "rounded-full h-8 w-8 object-cover" : "rounded-md h-8 w-8"
                )}
                unoptimized={isBase64}
            />
        ) : (
            <div className="p-2 bg-primary/10 rounded-md">
                <School className="h-5 w-5 text-primary"/>
            </div>
        )}
      {!hideName && <span className="font-headline">{saccoName || 'SACCO System'}</span>}
    </Link>
  );
}
