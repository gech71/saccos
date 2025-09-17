
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Globe, Info, Phone, Mail, Link as LinkIcon } from 'lucide-react';
import { getWebsiteContentForAdmin, updateWebsiteContent } from './actions';
import type { WebsiteContent } from '@prisma/client';
import { useAuth } from '@/contexts/auth-context';
import { FileUpload } from '@/components/file-upload';

export default function WebsiteSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [content, setContent] = useState<Partial<WebsiteContent>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const canEdit = useMemo(() => user?.permissions.includes('website:edit'), [user]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const data = await getWebsiteContentForAdmin();
        setContent(data || {});
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load website content.' });
      }
      setIsLoading(false);
    }
    fetchData();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContent(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (url: string) => {
    setContent(prev => ({ ...prev, logoUrl: url }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to edit website settings.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await updateWebsiteContent(content);
      toast({ title: 'Success', description: 'Website content has been updated successfully.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update website content.' });
    }
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
          
          {/* Main Content Column */}
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
                  <Label htmlFor="logoUrl">Logo URL</Label>
                   <FileUpload
                        id="logoUrl"
                        label="Upload your SACCO's logo"
                        value={content.logoUrl || ''}
                        onValueChange={handleLogoChange}
                    />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Page Content</CardTitle>
                <CardDescription>The text that appears on your homepage and about page.</CardDescription>
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
              </CardContent>
            </Card>
          </div>
          
          {/* Contact and Socials Column */}
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><LinkIcon className="h-5 w-5 text-primary" /> Social Media Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="facebookUrl">Facebook URL</Label>
                  <Input id="facebookUrl" name="facebookUrl" value={content.facebookUrl || ''} onChange={handleInputChange} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="twitterUrl">Twitter/X URL</Label>
                  <Input id="twitterUrl" name="twitterUrl" value={content.twitterUrl || ''} onChange={handleInputChange} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                  <Input id="linkedinUrl" name="linkedinUrl" value={content.linkedinUrl || ''} onChange={handleInputChange} disabled={!canEdit} />
                </div>
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
    </div>
  );
}
