'use server';

import prisma from '@/lib/prisma';
import type { WebsiteContent, Post, SocialMediaLink, Service, HeroSlide } from '@prisma/client';
import { revalidateTag } from 'next/cache';

export async function getWebsiteContentForAdmin() {
    let content = await prisma.websiteContent.findFirst({
        include: {
            socialLinks: {
                orderBy: {
                    name: 'asc'
                }
            },
            services: {
                orderBy: {
                    title: 'asc'
                }
            },
            heroSlides: {
                orderBy: {
                    order: 'asc'
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
                 primary: 'hsl(48, 96%, 53%)',
            },
            include: {
                socialLinks: true,
                services: true,
                heroSlides: true,
            }
        });
    }
    return content;
}

export async function updateWebsiteContent(data: Partial<WebsiteContent>): Promise<WebsiteContent> {
    const currentContent = await prisma.websiteContent.findFirst();
    
    // Exclude relation fields from the data payload for the update.
    // These are handled by their own dedicated create/update/delete functions.
    const { socialLinks, services, heroSlides, ...contentData } = data;

    let updatedContent;
    if (currentContent) {
        updatedContent = await prisma.websiteContent.update({
            where: { id: currentContent.id },
            data: contentData,
        });
    } else {
        // createMany is not supported for related records in this way.
        // The initial create should not have relational data.
        updatedContent = await prisma.websiteContent.create({
            data: contentData as WebsiteContent,
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

// SERVICE ACTIONS
export async function createOrUpdateService(data: Partial<Omit<Service, 'id'>> & { id?: string; contentId: string }): Promise<Service> {
  const { id, contentId, ...serviceData } = data;

  if (id) {
    // Update
    const updatedService = await prisma.service.update({
      where: { id },
      data: serviceData,
    });
    revalidateTag('website-content');
    return updatedService;
  } else {
    // Create
    const newService = await prisma.service.create({
      data: {
        title: serviceData.title!,
        description: serviceData.description!,
        icon: serviceData.icon!,
        content: { connect: { id: contentId } },
      },
    });
    revalidateTag('website-content');
    return newService;
  }
}

export async function deleteService(id: string): Promise<{ success: boolean }> {
  await prisma.service.delete({
    where: { id },
  });
  revalidateTag('website-content');
  return { success: true };
}

// HERO SLIDE ACTIONS
export async function createOrUpdateHeroSlide(data: Partial<Omit<HeroSlide, 'id' | 'content'>> & { id?: string; contentId: string }): Promise<HeroSlide> {
    const { id, contentId, ...slideData } = data;
    
    const dataToSave = {
        title: slideData.title!,
        subtitle: slideData.subtitle!,
        imageUrl: slideData.imageUrl!,
        imageHint: slideData.imageHint,
        link: slideData.link!,
        linkText: slideData.linkText!,
        order: slideData.order || 0,
        content: { connect: { id: contentId } },
    };

    if (id) {
        // Update
        const updatedSlide = await prisma.heroSlide.update({
            where: { id },
            data: dataToSave,
        });
        revalidateTag('website-content');
        return updatedSlide;
    } else {
        // Create
        const newSlide = await prisma.heroSlide.create({
            data: dataToSave,
        });
        revalidateTag('website-content');
        return newSlide;
    }
}

export async function deleteHeroSlide(id: string): Promise<{ success: boolean }> {
    await prisma.heroSlide.delete({
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
