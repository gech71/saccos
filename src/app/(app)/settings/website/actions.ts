
'use server';

import prisma from '@/lib/prisma';
import type { WebsiteContent, Post } from '@prisma/client';
import { revalidateTag } from 'next/cache';

export async function getWebsiteContentForAdmin() {
    let content = await prisma.websiteContent.findFirst();
    if (!content) {
        content = await prisma.websiteContent.create({
            data: {
                // Default initial values
                saccoName: 'AcademInvest',
                heroTitle: 'Empowering Your Financial Future, Together.',
                heroSubtitle: 'Your trusted partner in savings and credit for the educational community.',
            }
        });
    }
    return content;
}

export async function updateWebsiteContent(data: Partial<WebsiteContent>): Promise<WebsiteContent> {
    const currentContent = await prisma.websiteContent.findFirst();
    
    let updatedContent;
    if (currentContent) {
        updatedContent = await prisma.websiteContent.update({
            where: { id: currentContent.id },
            data,
        });
    } else {
        updatedContent = await prisma.websiteContent.create({
            data: data as WebsiteContent,
        });
    }
    
    revalidateTag('website-content');
    return updatedContent;
}


// NEWS POSTS ACTIONS

export async function getPostsForAdmin(): Promise<Post[]> {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return posts;
}

export async function createPost(data: Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'slug'>): Promise<Post> {
  const newPost = await prisma.post.create({
    data: {
      ...data,
      // Generate a URL-friendly slug from the title
      slug: data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
    },
  });
  revalidateTag('posts');
  return newPost;
}

export async function updatePost(id: string, data: Partial<Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'slug'>>): Promise<Post> {
  const postData = { ...data };
  if (data.title) {
    postData.slug = data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  }

  const updatedPost = await prisma.post.update({
    where: { id },
    data: postData,
  });
  revalidateTag('posts');
  return updatedPost;
}

export async function deletePost(id: string): Promise<Post> {
  const deletedPost = await prisma.post.delete({
    where: { id },
  });
  revalidateTag('posts');
  return deletedPost;
}
