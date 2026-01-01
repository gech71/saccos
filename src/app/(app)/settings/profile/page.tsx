
'use client';

import { PageTitle } from '@/components/page-title';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import React, { useState } from 'react';
import { UserCircle, Camera, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Alert, AlertDescription } from '@/components/ui/alert';

const passwordSchema = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function ProfileSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [userProfile, setUserProfile] = useState({
    firstName: user?.firstName || 'Academ',
    lastName: user?.lastName || 'User',
    email: user?.email || 'user@example.com',
    avatarUrl: user?.image || '',
  });
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({ ...prev, [name]: value }));
  };
  
  const handleProfileSave = () => {
    setIsSavingProfile(true);
    // Simulate API call
    setTimeout(() => {
      toast({ title: 'Profile Updated', description: 'Your profile information has been saved.' });
      setIsSavingProfile(false);
    }, 1000);
  };

  const handlePasswordChange = () => {
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!passwordSchema.test(newPassword)) {
      setPasswordError('New password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    // Simulate API call
    setTimeout(() => {
        toast({ title: 'Password Changed', description: 'Your password has been updated successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setIsChangingPassword(false);
    }, 1500)
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
          <Button onClick={handleProfileSave} className="ml-auto" disabled={isSavingProfile}>
            {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Save Profile Changes
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-primary">Change Password</CardTitle>
          <CardDescription>Update your account password. For security, choose a strong, unique password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {passwordError && (
            <Alert variant="destructive">
              <AlertDescription>{passwordError}</AlertDescription>
            </Alert>
          )}
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input id="currentPassword" type="password" placeholder="Enter your current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <p className="text-xs text-muted-foreground mt-2">
              Must be at least 8 characters and include uppercase, lowercase, number, and special character.
            </p>
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input id="confirmPassword" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handlePasswordChange} className="ml-auto" disabled={isChangingPassword}>
             {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Change Password
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
