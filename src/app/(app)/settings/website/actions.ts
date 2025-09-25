

'use server';

import prisma from '@/lib/prisma';
import type { WebsiteContent, Post, SocialMediaLink, Service, HeroSlide } from '@prisma/client';
import { revalidateTag } from 'next/cache';

export async function getWebsiteContentForAdmin() {
    try {
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
                    logo: '',
                },
                include: {
                    socialLinks: true,
                    services: true,
                    heroSlides: true,
                }
            });
        }
        return content;
    } catch (error) {
        console.error('Failed to fetch website content for admin:', error);
        throw new Error('Could not load website content.');
    }
}

export async function updateWebsiteContent(data: Partial<WebsiteContent>): Promise<WebsiteContent> {
    try {
        const currentContent = await prisma.websiteContent.findFirst();
        
        const { socialLinks, services, heroSlides, ...contentData } = data;

        let updatedContent;
        if (currentContent) {
            updatedContent = await prisma.websiteContent.update({
                where: { id: currentContent.id },
                data: contentData,
            });
        } else {
            updatedContent = await prisma.websiteContent.create({
                data: contentData as WebsiteContent,
            });
        }
        
        revalidateTag('website-content');
        return updatedContent;
    } catch (error) {
        console.error('Failed to update website content:', error);
        throw new Error('An unexpected error occurred while updating website content.');
    }
}

// SOCIAL MEDIA ACTIONS
export async function createOrUpdateSocialMediaLink(data: Partial<Omit<SocialMediaLink, 'id'>> & { id?: string; contentId: string }): Promise<SocialMediaLink> {
  try {
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
          websiteContent: { connect: { id: contentId } },
        },
      });
      revalidateTag('website-content');
      return newLink;
    }
  } catch (error) {
    console.error('Failed to save social media link:', error);
    throw new Error('An unexpected error occurred while saving the social link.');
  }
}

export async function deleteSocialMediaLink(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.socialMediaLink.delete({
      where: { id },
    });
    revalidateTag('website-content');
    return { success: true };
  } catch (error) {
      console.error('Failed to delete social media link:', error);
      throw new Error('An unexpected error occurred while deleting the social link.');
  }
}

// SERVICE ACTIONS
export async function createOrUpdateService(data: Partial<Omit<Service, 'id'>> & { id?: string; contentId: string }): Promise<Service> {
  try {
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
          websiteContent: { connect: { id: contentId } },
        },
      });
      revalidateTag('website-content');
      return newService;
    }
  } catch (error) {
      console.error('Failed to save service:', error);
      throw new Error('An unexpected error occurred while saving the service.');
  }
}

export async function deleteService(id: string): Promise<{ success: boolean }> {
  try {
    await prisma.service.delete({
      where: { id },
    });
    revalidateTag('website-content');
    return { success: true };
  } catch (error) {
      console.error('Failed to delete service:', error);
      throw new Error('An unexpected error occurred while deleting the service.');
  }
}

// HERO SLIDE ACTIONS
export async function createOrUpdateHeroSlide(data: Partial<Omit<HeroSlide, 'id' | 'websiteContent'>> & { id?: string; contentId: string }): Promise<HeroSlide> {
    try {
        const { id, contentId, ...slideData } = data;
        
        const dataToSave = {
            title: slideData.title!,
            subtitle: slideData.subtitle!,
            imageUrl: slideData.imageUrl!,
            imageHint: slideData.imageHint,
            link: slideData.link!,
            linkText: slideData.linkText!,
            order: slideData.order || 0,
            websiteContent: { connect: { id: contentId } },
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
    } catch (error) {
        console.error('Failed to save hero slide:', error);
        throw new Error('An unexpected error occurred while saving the hero slide.');
    }
}

export async function deleteHeroSlide(id: string): Promise<{ success: boolean }> {
    try {
        await prisma.heroSlide.delete({
            where: { id },
        });
        revalidateTag('website-content');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete hero slide:', error);
        throw new Error('An unexpected error occurred while deleting the hero slide.');
    }
}


// NEWS POSTS ACTIONS

export async function getPostsForAdmin(): Promise<Post[]> {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return posts;
  } catch (error) {
    console.error('Failed to get posts for admin:', error);
    throw new Error('Could not load news posts.');
  }
}

export async function createPost(data: Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'slug'>): Promise<Post> {
  try {
    const newPost = await prisma.post.create({
      data: {
        ...data,
        slug: data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
      },
    });
    revalidateTag('posts');
    return newPost;
  } catch (error) {
    console.error('Failed to create post:', error);
    throw new Error('An unexpected error occurred while creating the post.');
  }
}

export async function updatePost(id: string, data: Partial<Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'slug'>>): Promise<Post> {
  try {
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
  } catch (error) {
    console.error('Failed to update post:', error);
    throw new Error('An unexpected error occurred while updating the post.');
  }
}

export async function deletePost(id: string): Promise<Post> {
  try {
    const deletedPost = await prisma.post.delete({
      where: { id },
    });
    revalidateTag('posts');
    return deletedPost;
  } catch (error) {
      console.error('Failed to delete post:', error);
      throw new Error('An unexpected error occurred while deleting the post.');
  }
}
