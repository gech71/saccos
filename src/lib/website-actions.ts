
'use server';

import prisma from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

// Use unstable_cache for data that doesn't change often but needs to be fresh
// This acts like a server-side cache that can be revalidated.
export const getWebsiteContent = unstable_cache(
  async () => {
    const content = await prisma.websiteContent.findFirst({
        include: {
            socialLinks: true,
            services: true,
        }
    });
    return content;
  },
  ['website-content'], // Cache key
  {
    tags: ['website-content'], // Revalidation tag
  }
);

export const getPublishedPosts = unstable_cache(
  async () => {
    const posts = await prisma.post.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
    });
    return posts;
  },
  ['published-posts'],
  {
    tags: ['posts'],
  }
);


export const getPostById = unstable_cache(
  async (postId: string) => {
    if (!postId) return null;
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });
    return post;
  },
  ['post-by-id'],
  {
    tags: ['posts'],
  }
);
