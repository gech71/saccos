
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Globe, Info, Phone, Mail, Link as LinkIcon, PlusCircle, Trash2, Edit, HandCoins, Landmark, PiggyBank } from 'lucide-react';
import { getWebsiteContentForAdmin, updateWebsiteContent, createOrUpdateSocialMediaLink, deleteSocialMediaLink, createOrUpdateService, deleteService } from './actions';
import type { WebsiteContent, SocialMediaLink, Service } from '@prisma/client';
import { useAuth } from '@/contexts/auth-context';
import { FileUpload } from '@/components/file-upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const iconComponents: { [key: string]: React.ElementType } = {
    PiggyBank,
    Landmark,
    HandCoins,
};

export default function WebsiteSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [content, setContent] = useState<Partial<WebsiteContent & { socialLinks: SocialMediaLink[], services: Service[] }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isSocialLinkModalOpen, setIsSocialLinkModalOpen] = useState(false);
  const [currentSocialLink, setCurrentSocialLink] = useState<Partial<SocialMediaLink>>(initialSocialLinkFormState);
  const [isEditingSocialLink, setIsEditingSocialLink] = useState(false);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'social' | 'service'} | null>(null);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [currentService, setCurrentService] = useState<Partial<Service>>(initialServiceFormState);
  const [isEditingService, setIsEditingService] = useState(false);

  const canEdit = useMemo(() => user?.permissions.includes('website:edit'), [user]);

  const fetchContent = async () => {
    setIsLoading(true);
    try {
      const data = await getWebsiteContentForAdmin();
      setContent(data || {});
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load website content.' });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContent(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUploadChange = (field: keyof WebsiteContent, url: string) => {
    setContent(prev => ({ ...prev, [field]: url }));
  }
  
  const handleSocialLinkInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentSocialLink(prev => ({...prev, [name]: value}));
  };
  
  const handleSocialLinkIconChange = (url: string) => {
    setCurrentSocialLink(prev => ({...prev, iconUrl: url}));
  };
  
  const handleServiceInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentService(prev => ({...prev, [name]: value}));
  };
   const handleServiceIconUpload = (url: string) => {
    setCurrentService(prev => ({ ...prev, icon: url }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setIsSubmitting(true);
    try {
      await updateWebsiteContent(content);
      toast({ title: 'Success', description: 'Website content has been updated successfully.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update website content.' });
    }
    setIsSubmitting(false);
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
    if (!content?.id || !currentSocialLink.name || !currentSocialLink.url || !currentSocialLink.iconUrl) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all fields for the social link.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await createOrUpdateSocialMediaLink({ ...currentSocialLink, contentId: content.id });
      toast({ title: 'Success', description: `Social link for ${currentSocialLink.name} saved.` });
      await fetchContent();
      setIsSocialLinkModalOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save social link.' });
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

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content?.id || !currentService.title || !currentService.description) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill out title and description for the service.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await createOrUpdateService({ ...currentService, contentId: content.id });
      toast({ title: 'Success', description: `Service '${currentService.title}' saved.` });
      await fetchContent();
      setIsServiceModalOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save service.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const openDeleteAlert = (id: string, type: 'social' | 'service') => {
    setItemToDelete({id, type});
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
      }
      await fetchContent();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: `Failed to delete ${itemToDelete.type}.` });
    }
    setItemToDelete(null);
    setIsDeleteAlertOpen(false);
    setIsSubmitting(false);
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Website Settings" subtitle="Manage the content displayed on your public-facing website." />
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> General Information</CardTitle>
                <CardDescription>Basic details about your SACCO.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="saccoName">SACCO Name</Label>
                  <Input id="saccoName" name="saccoName" value={content.saccoName || ''} onChange={handleInputChange} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="logoUrl">Logo</Label>
                   <FileUpload
                        id="logoUrl"
                        label="Upload your SACCO's logo"
                        value={content.logoUrl || ''}
                        onValueChange={(url) => handleFileUploadChange('logoUrl', url)}
                    />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Page Content</CardTitle>
                <CardDescription>The text and images that appear on your homepage and about page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="heroTitle">Homepage Hero Title</Label>
                  <Input id="heroTitle" name="heroTitle" value={content.heroTitle || ''} onChange={handleInputChange} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="heroSubtitle">Homepage Hero Subtitle</Label>
                  <Textarea id="heroSubtitle" name="heroSubtitle" value={content.heroSubtitle || ''} onChange={handleInputChange} disabled={!canEdit} />
                </div>
                 <div>
                  <Label htmlFor="aboutUs">About Us Section Content</Label>
                  <Textarea id="aboutUs" name="aboutUs" value={content.aboutUs || ''} onChange={handleInputChange} rows={6} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="aboutUsImageUrl">About Us Image</Label>
                   <FileUpload
                        id="aboutUsImageUrl"
                        label="Upload an image for the About Us page"
                        value={content.aboutUsImageUrl || ''}
                        onValueChange={(url) => handleFileUploadChange('aboutUsImageUrl', url)}
                    />
                </div>
              </CardContent>
            </Card>
            
             <Card>
                <CardHeader className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-primary" /> Homepage Services</CardTitle>
                    </div>
                    {canEdit && <Button type="button" size="sm" onClick={() => openServiceModal()}><PlusCircle className="mr-2 h-4 w-4" /> Add Service</Button>}
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
                            {content.services?.length ? content.services.map(service => {
                                return (
                                    <TableRow key={service.id}>
                                        <TableCell>
                                          {service.icon ? (
                                            <Image src={service.icon} alt={service.title} width={32} height={32} className="rounded-sm object-cover" />
                                          ) : (
                                            <div className="h-8 w-8 bg-muted rounded-sm flex items-center justify-center">
                                                <HandCoins className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell className="font-medium">{service.title}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{service.description}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openServiceModal(service)} disabled={!canEdit}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDeleteAlert(service.id, 'service')} disabled={!canEdit}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            }) : (
                                <TableRow><TableCell colSpan={4} className="text-center h-24">No services configured yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

          </div>
          
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" value={content.address || ''} onChange={handleInputChange} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" name="phone" value={content.phone || ''} onChange={handleInputChange} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" name="email" type="email" value={content.email || ''} onChange={handleInputChange} disabled={!canEdit} />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2"><LinkIcon className="h-5 w-5 text-primary" /> Social Media Links</CardTitle>
                  </div>
                  {canEdit && <Button type="button" size="sm" onClick={() => openSocialLinkModal()}><PlusCircle className="mr-2 h-4 w-4" /> Add Link</Button>}
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
                        {content.socialLinks?.length ? content.socialLinks.map(link => (
                            <TableRow key={link.id}>
                                <TableCell className="font-medium">{link.name}</TableCell>
                                <TableCell className="truncate max-w-[150px]"><a href={link.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{link.url}</a></TableCell>
                                <TableCell className="text-right">
                                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSocialLinkModal(link)} disabled={!canEdit}><Edit className="h-4 w-4" /></Button>
                                     <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => openDeleteAlert(link.id, 'social')} disabled={!canEdit}><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={3} className="text-center h-24">No social links added yet.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {canEdit && (
            <div className="flex justify-end mt-8">
                <Button type="submit" disabled={isSubmitting || isLoading}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>
        )}
      </form>
      
      {/* Social Link Modal */}
      <Dialog open={isSocialLinkModalOpen} onOpenChange={setIsSocialLinkModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{isEditingSocialLink ? 'Edit' : 'Add'} Social Media Link</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSocialLinkSubmit} className="space-y-4 py-4">
                <div>
                    <Label htmlFor="socialName">Platform Name</Label>
                    <Input id="socialName" name="name" value={currentSocialLink.name || ''} onChange={handleSocialLinkInputChange} placeholder="e.g., Facebook" required />
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
                    <Input id="socialUrl" name="url" type="url" value={currentSocialLink.url || ''} onChange={handleSocialLinkInputChange} placeholder="https://facebook.com/yoursacco" required />
                </div>
                 <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Link'}</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
      
       {/* Service Modal */}
      <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{isEditingService ? 'Edit' : 'Add'} Service</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleServiceSubmit} className="space-y-4 py-4">
                <div>
                    <Label htmlFor="serviceTitle">Title</Label>
                    <Input id="serviceTitle" name="title" value={currentService.title || ''} onChange={handleServiceInputChange} required />
                </div>
                <div>
                    <Label htmlFor="serviceDescription">Description</Label>
                    <Textarea id="serviceDescription" name="description" value={currentService.description || ''} onChange={handleServiceInputChange} required />
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
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Service'}</Button>
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
            <AlertDialogAction onClick={handleDeleteItem} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
