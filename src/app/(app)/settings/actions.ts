
'use server';

import prisma from '@/lib/prisma';
import type { User, Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// Centralized list of all permissions in the system
export const permissionsList = [
  'manage_users',
  'manage_roles',
  'manage_settings',
  'manage_members',
  'manage_schools',
  'manage_finances', // Broad category for savings, loans, etc.
  'manage_configuration', // For loan types, share types, etc.
  'approve_transactions',
  'view_reports',
];

export interface UserWithRoles extends User {
  roles: Role[];
}

export interface RoleWithUserCount extends Role {
    _count: {
        users: number;
    }
}

export interface SettingsPageData {
  users: UserWithRoles[];
  roles: RoleWithUserCount[];
}

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        roles: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.role.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { users, roles };
}

// User-related actions
export async function updateUserRoles(userId: string, roleIds: string[]): Promise<User> {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      roles: {
        set: roleIds.map(id => ({ id })),
      },
    },
  });
  revalidatePath('/settings');
  return updatedUser;
}

// Role-related actions
export type RoleInput = Omit<Role, 'id'>;

export async function createOrUpdateRole(data: Partial<RoleInput> & { id?: string }): Promise<Role> {
  const { id, ...roleData } = data;

  if (id) {
    // Update
    const updatedRole = await prisma.role.update({
      where: { id },
      data: roleData,
    });
    revalidatePath('/settings');
    return updatedRole;
  } else {
    // Create
    const newRole = await prisma.role.create({
      data: roleData as RoleInput,
    });
    revalidatePath('/settings');
    return newRole;
  }
}

export async function deleteRole(roleId: string): Promise<{ success: boolean; message: string }> {
  const usersWithRole = await prisma.user.count({
    where: { roles: { some: { id: roleId } } },
  });

  if (usersWithRole > 0) {
    return { success: false, message: 'Cannot delete role. It is currently assigned to one or more users.' };
  }

  try {
    await prisma.role.delete({ where: { id: roleId } });
    revalidatePath('/settings');
    return { success: true, message: 'Role deleted successfully.' };
  } catch (error) {
    console.error('Failed to delete role:', error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
