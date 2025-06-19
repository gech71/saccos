'use client';

import { PageTitle } from '@/components/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import React, { useState, useEffect } from 'react';

export default function SettingsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState({
    emailNews: true,
    emailActivity: false,
    pushActivity: true,
  });
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      setDarkMode(storedTheme === 'dark');
    } else {
      setDarkMode(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  const handleThemeChange = (checked: boolean) => {
    setDarkMode(checked);
    localStorage.setItem('theme', checked ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', checked);
    toast({ title: 'Theme Updated', description: `Theme set to ${checked ? 'Dark' : 'Light'} Mode.` });
  };
  
  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({...prev, [key]: !prev[key]}));
  };

  const handleSaveChanges = () => {
    // Simulate saving settings
    toast({ title: 'Settings Saved', description: 'Your preferences have been updated.' });
  };

  return (
    <div className="space-y-8">
      <PageTitle title="Settings" subtitle="Manage your account and application preferences." />

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-primary">Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {['Profile', 'Appearance', 'Notifications', 'Security'].map(item => (
                <Button key={item} variant="ghost" className="w-full justify-start">
                  {item}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-primary">Profile Information</CardTitle>
              <CardDescription>Update your personal details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" defaultValue="Academ" />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" defaultValue="User" />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="user@example.com" />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Tell us a little about yourself"
                  defaultValue="Dedicated member of the AcademInvest community."
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveChanges} className="ml-auto">Save Profile</Button>
            </CardFooter>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-primary">Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="darkMode" className="text-base">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable dark theme for a different visual experience.
                  </p>
                </div>
                <Switch
                  id="darkMode"
                  checked={darkMode}
                  onCheckedChange={handleThemeChange}
                  aria-label="Toggle dark mode"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-primary">Notification Settings</CardTitle>
              <CardDescription>Manage how you receive notifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <NotificationItem 
                    id="emailNews"
                    label="Email Notifications for News & Updates"
                    description="Receive emails about new features and updates."
                    checked={notifications.emailNews}
                    onCheckedChange={() => handleNotificationChange('emailNews')}
                />
                <Separator />
                 <NotificationItem 
                    id="emailActivity"
                    label="Email Notifications for Account Activity"
                    description="Get emails for important account activities."
                    checked={notifications.emailActivity}
                    onCheckedChange={() => handleNotificationChange('emailActivity')}
                />
                <Separator />
                <NotificationItem 
                    id="pushActivity"
                    label="Push Notifications for Real-time Activity"
                    description="Receive push notifications for immediate updates (if app supports it)."
                    checked={notifications.pushActivity}
                    onCheckedChange={() => handleNotificationChange('pushActivity')}
                />
            </CardContent>
             <CardFooter>
              <Button onClick={handleSaveChanges} className="ml-auto">Save Notifications</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface NotificationItemProps {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}

function NotificationItem({id, label, description, checked, onCheckedChange}: NotificationItemProps) {
    return (
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
            <Label htmlFor={id} className="text-base">
                {label}
            </Label>
            <p className="text-sm text-muted-foreground">
                {description}
            </p>
            </div>
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onCheckedChange}
                aria-label={label}
            />
        </div>
    )
}

