
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Save,
  Globe,
  Info,
  Phone,
  Mail,
  Link as LinkIcon,
  PlusCircle,
  Trash2,
  Edit,
  HandCoins,
  Palette,
  ImageIcon
} from 'lucide-react';
import {
  getWebsiteContentForAdmin,
  updateWebsiteContent,
  createOrUpdateSocialMediaLink,
  deleteSocialMediaLink,
  createOrUpdateService,
  deleteService,
  createOrUpdateHeroSlide,
  deleteHeroSlide,
} from './actions';
import type { WebsiteContent, SocialMediaLink, Service, HeroSlide } from '@prisma/client';
import { useAuth } from '@/contexts/auth-context';
import { FileUpload } from '@/components/file-upload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Image from 'next/image';

const initialSocialLinkFormState: Partial<SocialMediaLink> = {
  name: '',
  url: '',
  iconUrl: '',
};

const initialServiceFormState: Partial<Service> = {
  title: '',
  description: '',
  icon: null,
};

const initialHeroSlideFormState: Partial<HeroSlide> = {
    title: '',
    subtitle: '',
    imageUrl: '',
    imageHint: '',
    link: '/',
    linkText: 'Learn More',
    order: 0,
};

export default function WebsiteSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [
    content,
    setContent,
  ] = useState<
    Partial<WebsiteContent & { socialLinks: SocialMediaLink[]; services: Service[], heroSlides: HeroSlide[] }>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isSocialLinkModalOpen, setIsSocialLinkModalOpen] = useState(false);
  const [
    currentSocialLink,
    setCurrentSocialLink,
  ] = useState<Partial<SocialMediaLink>>(initialSocialLinkFormState);
  const [isEditingSocialLink, setIsEditingSocialLink] = useState(false);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [
    itemToDelete,
    setItemToDelete,
  ] = useState<{ id: string; type: 'social' | 'service' | 'hero' } | null>(null);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState<Partial<Service>>(
    initialServiceFormState
  );
  const [isEditingService, setIsEditingService] = useState(false);

  const [isHeroSlideModalOpen, setIsHeroSlideModalOpen] = useState(false);
  const [currentHeroSlide, setCurrentHeroSlide] = useState<Partial<HeroSlide>>(initialHeroSlideFormState);
  const [isEditingHeroSlide, setIsEditingHeroSlide] = useState(false);

  const canEdit = useMemo(() => user?.permissions.includes('website:edit'), [
    user,
  ]);

  const fetchContent = async () => {
    setIsLoading(true);
    try {
      const data = await getWebsiteContentForAdmin();
      setContent(data || {});
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load website content.',
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setContent((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUploadChange = (
    field: keyof WebsiteContent,
    url: string
  ) => {
    setContent((prev) => ({ ...prev, [field]: url }));
  };

  const handleSocialLinkInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setCurrentSocialLink((prev) => ({ ...prev, [name]: value }));
  };

  const handleSocialLinkIconChange = (url: string) => {
    setCurrentSocialLink((prev) => ({ ...prev, iconUrl: url }));
  };

  const handleServiceInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCurrentService((prev) => ({ ...prev, [name]: value }));
  };
  const handleServiceIconUpload = (url: string) => {
    setCurrentService((prev) => ({ ...prev, icon: url }));
  };
  
   const handleHeroSlideInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setCurrentHeroSlide((prev) => ({ ...prev, [name]: name === 'order' ? parseInt(value) : value }));
  };
  
  const handleHeroSlideImageUpload = (url: string) => {
      setCurrentHeroSlide((prev) => ({ ...prev, imageUrl: url }));
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit) return;
    setIsSubmitting(true);
    try {
      await updateWebsiteContent(content);
      toast({
        title: 'Success',
        description: 'Website content has been updated successfully.',
      });
      await fetchContent();
      // Force a page reload to apply new theme colors globally
      window.location.reload();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update website content.',
      });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openSocialLinkModal = (link?: SocialMediaLink) => {
    if (link) {
      setCurrentSocialLink(link);
      setIsEditingSocialLink(true);
    } else {
      setCurrentSocialLink(initialSocialLinkFormState);
      setIsEditingSocialLink(false);
    }
    setIsSocialLinkModalOpen(true);
  };

  const handleSocialLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !content?.id ||
      !currentSocialLink.name ||
      !currentSocialLink.url ||
      !currentSocialLink.iconUrl
    ) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill out all fields for the social link.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await createOrUpdateSocialMediaLink({
        ...currentSocialLink,
        contentId: content.id,
      });
      toast({
        title: 'Success',
        description: `Social link for ${currentSocialLink.name} saved.`,
      });
      await fetchContent();
      setIsSocialLinkModalOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save social link.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openServiceModal = (service?: Service) => {
    if (service) {
      setCurrentService(service);
      setIsEditingService(true);
    } else {
      setCurrentService(initialServiceFormState);
      setIsEditingService(false);
    }
    setIsServiceModalOpen(true);
  };
  
  const openHeroSlideModal = (slide?: HeroSlide) => {
      if (slide) {
          setCurrentHeroSlide(slide);
          setIsEditingHeroSlide(true);
      } else {
          setCurrentHeroSlide({...initialHeroSlideFormState, order: content.heroSlides?.length || 0 });
          setIsEditingHeroSlide(false);
      }
      setIsHeroSlideModalOpen(true);
  }

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content?.id || !currentService.title || !currentService.description) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill out title and description for the service.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await createOrUpdateService({ ...currentService, contentId: content.id });
      toast({
        title: 'Success',
        description: `Service '${currentService.title}' saved.`,
      });
      await fetchContent();
      setIsServiceModalOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save service.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
   const handleHeroSlideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content?.id || !currentHeroSlide.title || !currentHeroSlide.subtitle || !currentHeroSlide.imageUrl || !currentHeroSlide.link || !currentHeroSlide.linkText) {
        toast({ variant: 'destructive', title: 'Error', description: 'All fields for the hero slide are required.' });
        return;
    }
    setIsSubmitting(true);
    try {
        await createOrUpdateHeroSlide({ ...currentHeroSlide, contentId: content.id } as Omit<HeroSlide, 'websiteContent'>);
        toast({ title: 'Success', description: `Hero slide '${currentHeroSlide.title}' saved.` });
        await fetchContent();
        setIsHeroSlideModalOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save hero slide.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const openDeleteAlert = (id: string, type: 'social' | 'service' | 'hero') => {
    setItemToDelete({ id, type });
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsSubmitting(true);
    try {
      if (itemToDelete.type === 'social') {
        await deleteSocialMediaLink(itemToDelete.id);
        toast({ title: 'Success', description: 'Social media link deleted.' });
      } else if (itemToDelete.type === 'service') {
        await deleteService(itemToDelete.id);
        toast({ title: 'Success', description: 'Service deleted.' });
      } else if (itemToDelete.type === 'hero') {
        await deleteHeroSlide(itemToDelete.id);
        toast({ title: 'Success', description: 'Hero slide deleted.' });
      }
      await fetchContent();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to delete ${itemToDelete.type}.`,
      });
    }
    setItemToDelete(null);
    setIsDeleteAlertOpen(false);
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageTitle
        title="Website Settings"
        subtitle="Manage the content displayed on your public-facing website."
      />

      <form>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" /> General Information
                </CardTitle>
                <CardDescription>Basic details about your SACCO.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="saccoName">SACCO Name</Label>
                  <Input
                    id="saccoName"
                    name="saccoName"
                    value={content.saccoName || ''}
                    onChange={handleInputChange}
                    disabled={!canEdit}
                  />
                </div>
                 <div>
                  <Label>Logo</Label>
                  <div className="mt-2 flex items-center gap-4">
                     <FileUpload
                      id="logo"
                      label="Upload Logo"
                      value={content.logo || ''}
                      onValueChange={(url) =>
                        handleFileUploadChange('logo', url)}
                    />
                    {content.logo && (
                      <div className="relative w-20 h-20 border rounded-md p-2 bg-muted">
                        <Image src={content.logo} alt="Logo Preview" fill style={{ objectFit: 'contain' }} unoptimized />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

             <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-primary"/> Homepage Hero Carousel</CardTitle>
                        <CardDescription>Manage the rotating slides on your homepage.</CardDescription>
                    </div>
                    {canEdit && (<Button type="button" size="sm" onClick={() => openHeroSlideModal()}><PlusCircle className="mr-2 h-4 w-4"/> Add Slide</Button>)}
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Title</TableHead><TableHead>Image</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {content.heroSlides && content.heroSlides.length > 0 ? (
                                content.heroSlides.sort((a,b) => a.order - b.order).map(slide => (
                                    <TableRow key={slide.id}>
                                        <TableCell>{slide.order}</TableCell>
                                        <TableCell className="font-medium">{slide.title}</TableCell>
                                        <TableCell><Image src={slide.imageUrl} alt={slide.title} width={80} height={45} className="rounded-md object-cover aspect-video"/></TableCell>
                                        <TableCell className="text-right">
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openHeroSlideModal(slide)} disabled={!canEdit}><Edit className="h-4 w-4"/></Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDeleteAlert(slide.id, 'hero')} disabled={!canEdit}><Trash2 className="h-4 w-4"/></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="text-center h-24">No hero slides configured.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" /> Page Content
                </CardTitle>
                <CardDescription>
                  The text and images that appear on your homepage and about
                  page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="aboutUs">About Us Section Content</Label>
                  <Textarea
                    id="aboutUs"
                    name="aboutUs"
                    value={content.aboutUs || ''}
                    onChange={handleInputChange}
                    rows={6}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="aboutUsImageUrl">About Us Image</Label>
                   <div className="mt-2 flex items-center gap-4">
                      <FileUpload
                        id="aboutUsImageUrl"
                        label="Upload an image for the About Us page"
                        value={content.aboutUsImageUrl || ''}
                        onValueChange={(url) =>
                          handleFileUploadChange('aboutUsImageUrl', url)}
                      />
                      {content.aboutUsImageUrl && (
                        <div className="relative w-32 h-20 border rounded-md p-1 bg-muted">
                           <Image src={content.aboutUsImageUrl} alt="About Us Preview" fill style={{ objectFit: 'cover' }} unoptimized />
                        </div>
                      )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <HandCoins className="h-5 w-5 text-primary" /> Homepage
                    Services
                  </CardTitle>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openServiceModal()}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Service
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Icon</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {content.services?.length ? (
                      content.services.map((service) => {
                        return (
                          <TableRow key={service.id}>
                            <TableCell>
                              {service.icon ? (
                                <Image
                                  src={service.icon}
                                  alt={service.title}
                                  width={32}
                                  height={32}
                                  className="rounded-sm object-cover"
                                  unoptimized={service.icon.startsWith('data:image')}
                                />
                              ) : (
                                <div className="h-8 w-8 bg-muted rounded-sm flex items-center justify-center">
                                  <HandCoins className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {service.title}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {service.description}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openServiceModal(service)}
                                disabled={!canEdit}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => openDeleteAlert(service.id, 'service')}
                                disabled={!canEdit}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">
                          No services configured yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary"/> Theme Customization</CardTitle>
                    <CardDescription>Customize the look and feel of your application.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <Label htmlFor="primaryColor">Primary Color (for buttons, active items)</Label>
                        <div className="flex items-center gap-4 mt-2">
                            <Input
                                id="primaryColor"
                                name="primary"
                                type="color"
                                value={content.primary || '#FBBF24'}
                                onChange={handleInputChange}
                                className="w-16 h-10 p-1"
                                disabled={!canEdit}
                            />
                            <Button style={{ backgroundColor: content.primary || '#FBBF24' }}>Primary Button</Button>
                        </div>
                    </div>
                     <div>
                        <Label htmlFor="accentColor">Accent Color (for backgrounds)</Label>
                        <div className="flex items-center gap-4 mt-2">
                             <Input
                                id="accentColor"
                                name="accent"
                                type="color"
                                value={content.accent || '#4A2E19'}
                                onChange={handleInputChange}
                                className="w-16 h-10 p-1"
                                disabled={!canEdit}
                            />
                            <Button style={{ backgroundColor: content.accent || '#4A2E19' }}>Accent Background</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" /> Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={content.address || ''}
                    onChange={handleInputChange}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={content.phone || ''}
                    onChange={handleInputChange}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={content.email || ''}
                    onChange={handleInputChange}
                    disabled={!canEdit}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-primary" /> Social Media
                    Links
                  </CardTitle>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openSocialLinkModal()}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Link
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {content.socialLinks?.length ? (
                      content.socialLinks.map((link) => (
                        <TableRow key={link.id}>
                          <TableCell className="font-medium">
                            {link.name}
                          </TableCell>
                          <TableCell className="truncate max-w-[150px]">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {link.url}
                            </a>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openSocialLinkModal(link)}
                              disabled={!canEdit}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => openDeleteAlert(link.id, 'social')}
                              disabled={!canEdit}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center h-24">
                          No social links added yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end mt-8">
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting || isLoading}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </form>
      
      {/* Hero Slide Modal */}
      <Dialog open={isHeroSlideModalOpen} onOpenChange={setIsHeroSlideModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{isEditingHeroSlide ? 'Edit' : 'Add'} Hero Slide</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleHeroSlideSubmit} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
            <div><Label htmlFor="slideTitle">Title</Label><Input id="slideTitle" name="title" value={currentHeroSlide.title || ''} onChange={handleHeroSlideInputChange} required /></div>
            <div><Label htmlFor="slideSubtitle">Subtitle</Label><Input id="slideSubtitle" name="subtitle" value={currentHeroSlide.subtitle || ''} onChange={handleHeroSlideInputChange} required /></div>
            <div>
                <Label htmlFor="slideImageUrl">Image</Label>
                <div className="mt-2 flex items-center gap-4">
                    <FileUpload id="slideImageUrl" label="Upload slide image" value={currentHeroSlide.imageUrl || ''} onValueChange={handleHeroSlideImageUpload} />
                     {currentHeroSlide.imageUrl && (
                        <div className="relative w-32 h-20 border rounded-md p-1 bg-muted">
                           <Image src={currentHeroSlide.imageUrl} alt="Hero Slide Preview" fill style={{ objectFit: 'cover' }} unoptimized />
                        </div>
                      )}
                </div>
            </div>
            <div><Label htmlFor="slideImageHint">Image Hint (for AI)</Label><Input id="slideImageHint" name="imageHint" value={currentHeroSlide.imageHint || ''} onChange={handleHeroSlideInputChange} placeholder="e.g., community finance"/></div>
            <div><Label htmlFor="slideLink">Link URL</Label><Input id="slideLink" name="link" value={currentHeroSlide.link || ''} onChange={handleHeroSlideInputChange} required /></div>
            <div><Label htmlFor="slideLinkText">Link Button Text</Label><Input id="slideLinkText" name="linkText" value={currentHeroSlide.linkText || ''} onChange={handleHeroSlideInputChange} required /></div>
            <div><Label htmlFor="slideOrder">Order</Label><Input id="slideOrder" name="order" type="number" value={currentHeroSlide.order ?? 0} onChange={handleHeroSlideInputChange} required /></div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Slide</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* Social Link Modal */}
      <Dialog
        open={isSocialLinkModalOpen}
        onOpenChange={setIsSocialLinkModalOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditingSocialLink ? 'Edit' : 'Add'} Social Media Link
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSocialLinkSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="socialName">Platform Name</Label>
              <Input
                id="socialName"
                name="name"
                value={currentSocialLink.name || ''}
                onChange={handleSocialLinkInputChange}
                placeholder="e.g., Facebook"
                required
              />
            </div>
            <div>
              <Label htmlFor="iconUrl">Icon Image</Label>
              <FileUpload
                id="iconUrl"
                label="Upload an icon"
                value={currentSocialLink.iconUrl || ''}
                onValueChange={handleSocialLinkIconChange}
              />
            </div>
            <div>
              <Label htmlFor="socialUrl">URL</Label>
              <Input
                id="socialUrl"
                name="url"
                type="url"
                value={currentSocialLink.url || ''}
                onChange={handleSocialLinkInputChange}
                placeholder="https://facebook.com/yoursacco"
                required
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'Save Link'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Service Modal */}
      <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditingService ? 'Edit' : 'Add'} Service
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleServiceSubmit} className="space-y-4 py-4">
            <div>
              <Label htmlFor="serviceTitle">Title</Label>
              <Input
                id="serviceTitle"
                name="title"
                value={currentService.title || ''}
                onChange={handleServiceInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="serviceDescription">Description</Label>
              <Textarea
                id="serviceDescription"
                name="description"
                value={currentService.description || ''}
                onChange={handleServiceInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="serviceIcon">Icon (Optional)</Label>
              <FileUpload
                id="serviceIcon"
                label="Upload a custom icon"
                value={currentService.icon || ''}
                onValueChange={handleServiceIconUpload}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'Save Service'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Item Alert */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
