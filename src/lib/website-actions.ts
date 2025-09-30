
'use server';

import prisma from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import DOMPurify from 'isomorphic-dompurify';

// Use unstable_cache for data that doesn't change often but needs to be fresh
// This acts like a server-side cache that can be revalidated.
export const getWebsiteContent = unstable_cache(
  async () => {
    try {
      const content = await prisma.websiteContent.findFirst({
          include: {
              socialLinks: true,
              services: true,
              heroSlides: true,
          }
      });
      return content;
    } catch (error) {
      console.error("Failed to fetch website content, returning null.", error);
      return null;
    }
  },
  ['website-content'], // Cache key
  {
    tags: ['website-content'], // Revalidation tag
  }
);

export const getPublishedPosts = unstable_cache(
  async () => {
    try {
      const posts = await prisma.post.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: 'desc' },
      });
      // Sanitize content for every post
      return posts.map(post => ({
        ...post,
        content: DOMPurify.sanitize(post.content),
      }));
    } catch (error) {
       console.error("Failed to fetch published posts, returning empty array.", error);
       return [];
    }
  },
  ['published-posts'],
  {
    tags: ['posts'],
  }
);


export const getPostById = unstable_cache(
  async (postId: string) => {
    if (!postId) return null;
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
      });
      if (post) {
        // Sanitize the content before returning
        post.content = DOMPurify.sanitize(post.content);
      }
      return post;
    } catch (error) {
      console.error(`Failed to fetch post by ID ${postId}, returning null.`, error);
      return null;
    }
  },
  ['post-by-id'],
  {
    tags: ['posts'],
  }
);
