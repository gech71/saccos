
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OMITTED FOR BEREVITY
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "play-lh.googleusercontent.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "http", hostname: "nibsaccos.nibbank.com.et" },
      { protocol: "https", hostname: "nibsaccos.nibbank.com.et" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "localhost" }, // Added to trust https localhost
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  // OMITTED FOR BEREVITY
};

export default nextConfig;
