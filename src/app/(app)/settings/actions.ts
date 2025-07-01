
'use server';

import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { User, Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import axios from 'axios';
import { permissionsList } from './permissions';

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL || 'http://localhost:5160';

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

export async function syncUserOnLogin(userId: string, name: string, email: string) {
    const user = await prisma.user.upsert({
        where: { userId },
        update: { name, email },
        create: {
            userId,
            name,
            email,
            roles: {
                connectOrCreate: {
                    where: { name: 'Staff' },
                    create: { 
                        name: 'Staff', 
                        description: 'Regular staff member', 
                        permissions: ['dashboard:view', 'school:view', 'member:view', 'saving:view']
                    }
                }
            }
        },
        include: {
            roles: true,
        },
    });
    return user;
}


export async function registerUserByAdmin(data: any, roleIds: string[], token: string | null) {
    if (!token) {
        throw new Error('Authentication token is missing. You must be logged in to register a user.');
    }

    let registerResponse;
    try {
        registerResponse = await axios.post(`${AUTH_API_URL}/api/Auth/register`, {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phoneNumber: data.phoneNumber,
            password: data.password,
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!registerResponse.data.isSuccess) {
            const message = (Array.isArray(registerResponse.data.errors) && registerResponse.data.errors.join(' '))
                          || registerResponse.data.message
                          || "Registration with auth service failed. The user might already exist, or the password may be too weak.";
            throw new Error(message);
        }

        if (!registerResponse.data.userId) {
            throw new Error("Auth service succeeded but did not return a user ID.");
        }
    } catch (error) {
        console.error("Error during external auth registration:", error);
        if (axios.isAxiosError(error)) {
            const responseData = error.response?.data;
            if (responseData) {
                const message = (Array.isArray(responseData.errors) && responseData.errors.join(' ')) || responseData.message || "An unknown error occurred with the authentication service.";
                throw new Error(message);
            }
        }
        throw new Error(error instanceof Error ? error.message : "An external API error occurred.");
    }
    
    // If we get here, external registration was successful. Now, save to local DB.
    try {
        const externalUserId = registerResponse.data.userId;

        const newUser = await prisma.user.create({
            data: {
                userId: externalUserId,
                name: `${data.firstName} ${data.lastName}`,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                phoneNumber: data.phoneNumber,
                roles: {
                    connect: roleIds.map(id => ({ id })),
                },
            },
        });

        revalidatePath('/settings');
        return newUser;
    } catch (error) {
        console.error("Error saving user to local DB after successful auth registration:", error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // Unique constraint failed
            if (error.code === 'P2002') {
                const fields = error.meta?.target as string[] || ['field'];
                const fieldName = fields.join(', ');
                throw new Error(`Error: A user with this ${fieldName} already exists in the local database. This might be due to a previous failed registration. Please check the data or contact support.`);
            }
        }
        
        throw new Error("User was registered with the auth service, but saving to the local database failed. Please check for data inconsistencies.");
    }
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

// Permission-related actions
export async function getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
        where: { userId },
        include: { roles: true },
    });

    if (!user) return [];

    const permissions = new Set<string>();
    user.roles.forEach(role => {
        role.permissions.forEach(permission => {
            permissions.add(permission);
        });
    });

    return Array.from(permissions);
}
