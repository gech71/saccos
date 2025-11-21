

'use client';

import { PageTitle } from '@/components/page-title';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import React, { useState } from 'react';
import { UserCircle, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export default function ProfileSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [userProfile, setUserProfile] = useState({
    firstName: user?.firstName || 'Academ',
    lastName: user?.lastName || 'User',
    email: user?.email || 'user@example.com',
    avatarUrl: user?.image || '',
  });
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({ ...prev, [name]: value }));
  };
  
  const handleProfileSave = () => {
    // Simulate API call
    toast({ title: 'Profile Updated', description: 'Your profile information has been saved.' });
  };

  const handlePasswordChange = () => {
    if (newPassword && newPassword === confirmPassword) {
      // Simulate API call
      toast({ title: 'Password Changed', description: 'Your password has been updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    } else if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'New passwords do not match.' });
    } else {
       toast({ variant: 'destructive', title: 'Error', description: 'Please enter a new password.' });
    }
  };

  return (
    <div className="space-y-8">
      <PageTitle title="Profile Settings" subtitle="Manage your personal information and security." />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">Personal Information</CardTitle>
          <CardDescription>Update your name, email, and bio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={userProfile.avatarUrl} alt="User avatar" />
              <AvatarFallback>
                <UserCircle className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            <Button variant="outline">
              <Camera className="mr-2 h-4 w-4" /> Change Photo
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" name="firstName" value={userProfile.firstName} onChange={handleInputChange} />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" name="lastName" value={userProfile.lastName} onChange={handleInputChange} />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" name="email" type="email" value={userProfile.email} onChange={handleInputChange} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleProfileSave} className="ml-auto">Save Profile Changes</Button>
        </CardFooter>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">Change Password</CardTitle>
          <CardDescription>Update your account password. For security, choose a strong, unique password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" type="password" placeholder="Enter your current password" />
          </div>
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input id="confirmPassword" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handlePasswordChange} className="ml-auto">Change Password</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
