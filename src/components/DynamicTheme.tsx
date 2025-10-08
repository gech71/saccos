
'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

// Helper function to convert HEX to HSL, can be placed here or in a utils file
function hexToHsl(hex: string): string | null {
  if (!hex || !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) return null;
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  return `${h} ${s}% ${l}%`;
}


export function DynamicTheme() {
  const { content } = useAuth();

  useEffect(() => {
    if (content) {
      const primaryHsl = content.primary ? hexToHsl(content.primary) : null;
      const accentHsl = content.accent ? hexToHsl(content.accent) : null;
      
      const root = document.documentElement;
      if (primaryHsl) {
        root.style.setProperty('--primary', primaryHsl);
      }
       if (accentHsl) {
        root.style.setProperty('--accent', accentHsl);
      }
    }
  }, [content]);

  return null; // This component does not render anything itself
}
