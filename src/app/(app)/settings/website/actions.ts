
'use server';

import prisma from '@/lib/prisma';
import type { WebsiteContent, Post, SocialMediaLink } from '@prisma/client';
import { revalidateTag } from 'next/cache';

export async function getWebsiteContentForAdmin() {
    let content = await prisma.websiteContent.findFirst({
        include: {
            socialLinks: {
                orderBy: {
                    name: 'asc'
                }
            }
        }
    });
    if (!content) {
        content = await prisma.websiteContent.create({
            data: {
                saccoName: 'AcademInvest',
                heroTitle: 'Empowering Your Financial Future, Together.',
                heroSubtitle: 'Your trusted partner in savings and credit for the educational community.',
            },
            include: {
                socialLinks: true,
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

// SOCIAL MEDIA ACTIONS
export async function createOrUpdateSocialMediaLink(data: Partial<Omit<SocialMediaLink, 'id'>> & { id?: string; contentId: string }): Promise<SocialMediaLink> {
  const { id, contentId, ...linkData } = data;

  if (id) {
    // Update
    const updatedLink = await prisma.socialMediaLink.update({
      where: { id },
      data: linkData,
    });
    revalidateTag('website-content');
    return updatedLink;
  } else {
    // Create
    const newLink = await prisma.socialMediaLink.create({
      data: {
        name: linkData.name!,
        url: linkData.url!,
        iconUrl: linkData.iconUrl!,
        content: { connect: { id: contentId } },
      },
    });
    revalidateTag('website-content');
    return newLink;
  }
}

export async function deleteSocialMediaLink(id: string): Promise<{ success: boolean }> {
  await prisma.socialMediaLink.delete({
    where: { id },
  });
  revalidateTag('website-content');
  return { success: true };
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
