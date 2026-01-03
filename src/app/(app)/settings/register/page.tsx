
'use client';

import React, { useState, useEffect } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, UserPlus, Shield, KeyRound, Copy } from 'lucide-react';
import type { Role } from '@prisma/client';
import { getRolesForRegistration, registerUserByAdmin } from './actions';
import { Checkbox } from '@/components/ui/checkbox';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const passwordSchema = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const initialFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  password: '',
  roleIds: [] as string[],
};

export default function RegisterUserPage() {
  const [roles, setRoles] = useState<Pick<Role, 'id' | 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const { toast } = useToast();
  const router = useRouter();

  const [newUserInfo, setNewUserInfo] = useState<{ userName: string; setupLink: string } | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const rolesData = await getRolesForRegistration();
        setRoles(rolesData);

        // Fetch CSRF token for protected server actions
        try {
          const res = await fetch('/api/csrf');
          if (res.ok) {
            const data = await res.json();
            setCsrfToken(data.csrfToken || null);
          }
        } catch (e) {
          console.error('Failed to fetch CSRF token', e);
        }
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load roles.' });
      }
      setIsLoading(false);
    }
    fetchData();
  }, [toast]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (roleId: string, checked: boolean) => {
    setFormState(prev => {
        const newRoleIds = new Set(prev.roleIds);
        if (checked) {
            newRoleIds.add(roleId);
        } else {
            newRoleIds.delete(roleId);
        }
        return { ...prev, roleIds: Array.from(newRoleIds) };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.firstName || !formState.lastName || !formState.email || !formState.phoneNumber || formState.roleIds.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all required fields and select at least one role.' });
      return;
    }
    
    setIsSubmitting(true);
    const result = await registerUserByAdmin(formState, formState.roleIds, csrfToken || undefined);
    if (result.success && result.user && result.setupToken) {
      toast({ title: 'Success', description: 'New user has been registered successfully.' });
      const baseUrl = window.location.origin;
      const setupLink = `${baseUrl}/reset-password?token=${result.setupToken}`;
      setNewUserInfo({ userName: result.user!.name!, setupLink });
      setFormState(initialFormState); // Reset form
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      <PageTitle title="Register New User" subtitle="Create a new administrative user and assign their initial roles." />
      
      <Card className="max-w-2xl mx-auto shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="font-headline text-primary">New User Details</CardTitle>
            <CardDescription>Fill in the form below to create a new admin user account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                <Input id="firstName" name="firstName" value={formState.firstName} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input id="lastName" name="lastName" value={formState.lastName} onChange={handleInputChange} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                <Input id="email" name="email" type="email" value={formState.email} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone Number <span className="text-destructive">*</span></Label>
                <Input id="phoneNumber" name="phoneNumber" type="tel" value={formState.phoneNumber} onChange={handleInputChange} required />
              </div>
            </div>
            
            <Separator />

            <div>
                <Label className="font-semibold text-base">Assign Roles <span className="text-destructive">*</span></Label>
                <div className="space-y-2 pt-2">
                    {roles.map(role => (
                        <div key={role.id} className="flex items-center space-x-3">
                            <Checkbox 
                                id={`role-${role.id}`}
                                onCheckedChange={(checked) => handleRoleChange(role.id, !!checked)}
                            />
                             <Label htmlFor={`role-${role.id}`} className="font-normal flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <span>{role.name}</span>
                            </Label>
                        </div>
                    ))}
                </div>
            </div>

          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting || isLoading} className="w-full md:w-auto ml-auto">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserPlus className="mr-2 h-4 w-4" />
              Register User
            </Button>
          </CardFooter>
        </form>
      </Card>

      <AlertDialog open={!!newUserInfo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>User Created Successfully!</AlertDialogTitle>
            <AlertDialogDescription>
                A password setup link for <strong>{newUserInfo?.userName}</strong> has been generated. Please copy this link and securely share it with the new user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="relative">
            <Input value={newUserInfo?.setupLink} readOnly className="pr-10" />
            <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => {
                    navigator.clipboard.writeText(newUserInfo?.setupLink || '');
                    toast({ title: 'Copied!', description: 'Setup link copied to clipboard.' });
                }}
            >
                <Copy className="h-4 w-4" />
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
                setNewUserInfo(null);
                router.push('/settings');
            }}>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
