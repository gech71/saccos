
'use client';

import React, { useState, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getSettingsPageData, registerUserByAdmin } from '../actions';
import type { Role } from '@prisma/client';
import { useAuth } from '@/contexts/auth-context';

export default function RegisterUserPage() {
  const { toast } = useToast();
  const { accessToken } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    password: '',
  });
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingRoles, setIsFetchingRoles] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      setIsFetchingRoles(true);
      try {
        const data = await getSettingsPageData();
        setRoles(data.roles);
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch roles for assignment.' });
      } finally {
        setIsFetchingRoles(false);
      }
    }
    fetchRoles();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleRoleChange = (roleId: string, checked: boolean) => {
    setSelectedRoleIds(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(roleId);
      else newSet.delete(roleId);
      return newSet;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedRoleIds.size === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must assign at least one role to the new user.' });
      return;
    }

    setIsLoading(true);
    try {
      await registerUserByAdmin(formData, Array.from(selectedRoleIds), accessToken);
      toast({ title: 'User Registered', description: `Successfully created an account for ${formData.firstName} ${formData.lastName}.` });
      // Reset form
      setFormData({ firstName: '', lastName: '', phoneNumber: '', email: '', password: '' });
      setSelectedRoleIds(new Set());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({ variant: 'destructive', title: 'Registration Failed', description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle title="Register New User" subtitle="Create a new administrator or staff account." />
        <Button variant="outline" asChild>
            <Link href="/settings">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
            </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="font-headline text-primary">User Information</CardTitle>
            <CardDescription>Enter the personal and login details for the new user.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone Number <span className="text-destructive">*</span></Label>
                <Input id="phoneNumber" name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleInputChange} required />
              </div>
            </div>
             <div>
                <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                <Input id="password" name="password" type="password" value={formData.password} onChange={handleInputChange} required />
                 <p className="text-xs text-muted-foreground mt-1">
                    Password must be at least 6 characters and include an uppercase letter, a number, and a special character (e.g., !@#$%).
                </p>
            </div>
             <div>
                <Label className="font-semibold text-base text-primary">Assign Roles <span className="text-destructive">*</span></Label>
                {isFetchingRoles ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <div className="space-y-2 pt-2">
                    {roles.map(role => (
                      <div key={role.id} className="flex items-center space-x-2">
                        <Checkbox id={`role-${role.id}`} onCheckedChange={(checked) => handleRoleChange(role.id, !!checked)} />
                        <Label htmlFor={`role-${role.id}`} className="font-normal">{role.name}</Label>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isLoading || isFetchingRoles}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Register User
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
