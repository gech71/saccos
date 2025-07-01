
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PageTitle } from '@/components/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Shield, PlusCircle, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Role } from '@prisma/client';
import { getSettingsPageData, updateUserRoles, createOrUpdateRole, deleteRole, type UserWithRoles, type RoleWithUserCount } from './actions';
import Link from 'next/link';
import { permissionsByGroup } from './permissions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<RoleWithUserCount[]>([]);
  const { toast } = useToast();

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Partial<RoleWithUserCount>>({});
  const [isEditingRole, setIsEditingRole] = useState(false);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleWithUserCount | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPageData = async () => {
    setIsLoading(true);
    try {
      const data = await getSettingsPageData();
      setUsers(data.users);
      setRoles(data.roles);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load settings data.' });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPageData();
  }, [toast]);
  
  // User Modal Logic
  const openUserModal = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoleIds(new Set(user.roles.map(r => r.id)));
    setIsUserModalOpen(true);
  };

  const handleUserRoleChange = (roleId: string, checked: boolean) => {
    setSelectedRoleIds(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(roleId);
      else newSet.delete(roleId);
      return newSet;
    });
  };

  const handleUserRolesSave = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
        await updateUserRoles(selectedUser.id, Array.from(selectedRoleIds));
        toast({ title: 'Success', description: `Roles for ${selectedUser.name} have been updated.` });
        await fetchPageData();
        setIsUserModalOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update roles.' });
    }
    setIsSubmitting(false);
  };

  // Role Modal Logic
  const openRoleModal = (role?: RoleWithUserCount) => {
    if (role) {
        setIsEditingRole(true);
        setCurrentRole({...role});
    } else {
        setIsEditingRole(false);
        setCurrentRole({ name: '', description: '', permissions: [] });
    }
    setIsRoleModalOpen(true);
  };

  const handleRoleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentRole(prev => ({...prev, [name]: value}));
  };
  
  const handlePermissionChange = (permission: string, checked: boolean) => {
    setCurrentRole(prev => {
        const currentPermissions = new Set(prev.permissions || []);
        if (checked) currentPermissions.add(permission);
        else currentPermissions.delete(permission);
        return {...prev, permissions: Array.from(currentPermissions)};
    });
  };

  const handleGroupPermissionChange = (groupPermissions: string[], checked: boolean) => {
    setCurrentRole(prev => {
      const currentPermissions = new Set(prev.permissions || []);
      if (checked) {
        groupPermissions.forEach(p => currentPermissions.add(p));
      } else {
        groupPermissions.forEach(p => currentPermissions.delete(p));
      }
      return { ...prev, permissions: Array.from(currentPermissions) };
    });
  };

  const handleRoleSave = async () => {
    if (!currentRole.name) {
        toast({ variant: 'destructive', title: 'Error', description: 'Role name cannot be empty.' });
        return;
    }
    setIsSubmitting(true);
    try {
        await createOrUpdateRole({
            id: currentRole.id,
            name: currentRole.name,
            description: currentRole.description,
            permissions: currentRole.permissions || [],
        });
        toast({ title: 'Success', description: `Role '${currentRole.name}' saved successfully.` });
        await fetchPageData();
        setIsRoleModalOpen(false);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save role.' });
    }
    setIsSubmitting(false);
  };

  // Delete Role Logic
  const openDeleteAlert = (role: RoleWithUserCount) => {
    if (role._count.users > 0) {
        toast({ variant: 'destructive', title: 'Cannot Delete Role', description: 'This role is currently assigned to users.' });
        return;
    }
    setRoleToDelete(role);
    setIsDeleteAlertOpen(true);
  };
  
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setIsSubmitting(true);
    const result = await deleteRole(roleToDelete.id);
    if (result.success) {
        toast({ title: 'Success', description: result.message });
        await fetchPageData();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsSubmitting(false);
    setIsDeleteAlertOpen(false);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Application Settings" subtitle="Manage users, roles, and permissions for the application." />
      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
          <TabsTrigger value="users"><Users className="mr-2" /> User Management</TabsTrigger>
          <TabsTrigger value="roles"><Shield className="mr-2" /> Role Management</TabsTrigger>
        </TabsList>

        {/* User Management Tab */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Users</CardTitle>
                        <CardDescription>View all registered users and manage their assigned roles.</CardDescription>
                    </div>
                    <Button asChild>
                        <Link href="/settings/register">
                            <PlusCircle className="mr-2 h-4 w-4" /> Register New User
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="space-x-1">
                        {user.roles.length > 0 ? user.roles.map(role => (
                          <Badge key={role.id} variant="secondary">{role.name}</Badge>
                        )) : <span className="text-muted-foreground text-sm">No roles</span>}
                      </TableCell>
                      <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openUserModal(user)}>
                              <Edit className="mr-2 h-3.5 w-3.5" /> Manage Roles
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Management Tab */}
        <TabsContent value="roles" className="mt-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Roles</CardTitle>
                            <CardDescription>Define roles and what permissions they grant within the application.</CardDescription>
                        </div>
                        <Button onClick={() => openRoleModal()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Role
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Role Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Users</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {roles.map(role => (
                                <TableRow key={role.id}>
                                    <TableCell className="font-medium">{role.name}</TableCell>
                                    <TableCell>{role.description}</TableCell>
                                    <TableCell>{role._count.users}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openRoleModal(role)}><Edit className="mr-2 h-4 w-4" /> Edit Role</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openDeleteAlert(role)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Role</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      {/* User Roles Modal */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Roles for {selectedUser?.name}</DialogTitle>
            <DialogDescription>Select the roles to assign to this user. Changes will apply on their next login.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {roles.map(role => (
                <div key={role.id} className="flex items-center space-x-3">
                    <Checkbox id={`role-${role.id}`} checked={selectedRoleIds.has(role.id)} onCheckedChange={(checked) => handleUserRoleChange(role.id, !!checked)} />
                    <Label htmlFor={`role-${role.id}`} className="font-medium">{role.name}</Label>
                </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button onClick={handleUserRolesSave} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add/Edit Role Modal */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>{isEditingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
                <DialogDescription>Set the role name, description, and assigned permissions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="roleName">Role Name</Label>
                        <Input id="roleName" name="name" value={currentRole.name || ''} onChange={handleRoleInputChange} />
                    </div>
                    <div>
                         <Label htmlFor="roleDescription">Description (Optional)</Label>
                         <Input id="roleDescription" name="description" value={currentRole.description || ''} onChange={handleRoleInputChange} />
                    </div>
                </div>
                <div>
                    <Label>Permissions</Label>
                    <div className="mt-2 border rounded-md max-h-80 overflow-y-auto">
                        <Accordion type="multiple" className="w-full">
                            {Object.entries(permissionsByGroup).map(([groupName, perms]) => {
                                const groupPermissionIds = perms.map(p => p.id);
                                const selectedPermissionsInGroup = groupPermissionIds.filter(pId => (currentRole.permissions || []).includes(pId));
                                const allSelected = selectedPermissionsInGroup.length > 0 && selectedPermissionsInGroup.length === groupPermissionIds.length;
                                const someSelected = selectedPermissionsInGroup.length > 0 && !allSelected;

                                return (
                                    <AccordionItem value={groupName} key={groupName}>
                                        <div className="flex items-center">
                                            <div className="px-4 py-3">
                                                 <Checkbox
                                                  id={`group-select-${groupName}`}
                                                  checked={allSelected ? true : (someSelected ? 'indeterminate' : false)}
                                                  onCheckedChange={(checked) => {
                                                    handleGroupPermissionChange(groupPermissionIds, !!checked);
                                                  }}
                                                  aria-label={`Select all permissions for ${groupName}`}
                                                />
                                            </div>
                                            <AccordionTrigger className="flex-1 py-3 pr-4 text-base font-medium hover:no-underline">
                                                <span className="flex-1 text-left">{groupName}</span>
                                            </AccordionTrigger>
                                        </div>
                                        <AccordionContent>
                                            <div className="pl-12 pr-4 pt-2 pb-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                                                {perms.map(permission => (
                                                    <div key={permission.id} className="flex items-center space-x-3">
                                                        <Checkbox 
                                                            id={`perm-${permission.id}`}
                                                            checked={(currentRole.permissions || []).includes(permission.id)}
                                                            onCheckedChange={(checked) => handlePermissionChange(permission.id, !!checked)}
                                                        />
                                                        <Label htmlFor={`perm-${permission.id}`} className="font-normal text-sm capitalize cursor-pointer">
                                                            {permission.label}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </div>
                </div>
            </div>
             <DialogFooter>
                <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                <Button onClick={handleRoleSave} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Role
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Role Alert */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the "{roleToDelete?.name}" role.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteRole} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                     {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
