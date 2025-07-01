
'use server';

import prisma from '@/lib/prisma';
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
    
    try {
        // 1. Register user with the external auth provider
        const registerResponse = await axios.post(`${AUTH_API_URL}/api/Auth/register`, {
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

        // This block handles cases where the API returns a 200 OK but indicates a business logic failure.
        if (!registerResponse.data.isSuccess || !registerResponse.data.userId) {
            // Log the full API response for debugging on the server.
            console.error("External registration failed. API Response:", JSON.stringify(registerResponse.data, null, 2));
            
            // Attempt to find a more specific error message from the API response.
            let detailedErrorMessage = 'External registration failed. Please ensure the password meets complexity requirements and the user details are unique.'; // Default message
            if (registerResponse.data.errors && registerResponse.data.errors.length > 0) {
                detailedErrorMessage = registerResponse.data.errors.join(' ');
            } else if (registerResponse.data.message) {
                detailedErrorMessage = registerResponse.data.message;
            }
            
            throw new Error(detailedErrorMessage);
        }
        
        const externalUserId = registerResponse.data.userId;

        // 2. Create the user in the local Prisma database
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
        // This block handles network errors or non-2xx responses from the API.
        if (axios.isAxiosError(error) && error.response) {
            console.error('API Error Response:', JSON.stringify(error.response.data, null, 2));
            
            const apiErrors = error.response.data.errors || (error.response.data.message ? [error.response.data.message] : ['The server returned a bad request.']);
            const errorMessage = Array.isArray(apiErrors) ? apiErrors.join(' ') : 'An external API error occurred.';
            
            throw new Error(errorMessage);
        }

        // This block handles errors thrown from our own logic (e.g., from the `try` block above).
        if (error instanceof Error) {
            // Re-throw the specific error message to be displayed to the user.
            throw new Error(error.message);
        }

        // Fallback for any other kind of unexpected error.
        console.error('Unexpected Error during registration:', error);
        throw new Error('An unexpected error occurred during user registration.');
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
