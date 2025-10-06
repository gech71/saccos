
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HeroSlide } from '@prisma/client';

interface HeroCarouselProps {
  slides: HeroSlide[];
}

export function HeroCarousel({ slides }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    const interval = setInterval(nextSlide, 5000); // Rotate every 5 seconds
    return () => clearInterval(interval);
  }, [nextSlide]);

  return (
    <section className="relative w-full h-[60vh] overflow-hidden">
      {/* Slides */}
      {slides.map((slide, index) => {
        const isUnoptimized = slide.imageUrl.startsWith('/') || slide.imageUrl.startsWith('data:');
        return (
          <div
            key={slide.id || index}
            className={cn(
              'absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out',
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            )}
          >
            <Image
              src={slide.imageUrl}
              alt={slide.title}
              layout="fill"
              objectFit="cover"
              className="z-[-2]"
              data-ai-hint={slide.imageHint}
              priority={index === 0}
              unoptimized={isUnoptimized}
            />
            <div className="absolute inset-0 bg-black/40 z-[-1]"></div>
            <div className="container mx-auto px-4 md:px-6 h-full flex flex-col items-center justify-center text-center text-white z-10">
              <div className="max-w-3xl space-y-4 animate-in fade-in-50 duration-1000">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
                  {slide.title}
                </h1>
                <p className="text-lg md:text-xl text-gray-200">
                  {slide.subtitle}
                </p>
                <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center">
                  <Button asChild size="lg">
                    <Link href={slide.link}>{slide.linkText}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      
      {/* Navigation Dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={cn(
              'w-3 h-3 rounded-full transition-colors',
              index === currentIndex ? 'bg-primary' : 'bg-white/50 hover:bg-white/80'
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
