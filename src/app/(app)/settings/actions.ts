
"use server";

import prisma from "@/lib/prisma";
import type { User, Role, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { permissionsList } from "./permissions";
import bcrypt from 'bcryptjs';
import { logAudit } from "@/lib/audit-log";

export interface UserWithRoles extends User {
  roles: Role[];
}

export interface RoleWithUserCount extends Role {
  _count: {
    users: number;
  };
}

export interface SettingsPageData {
  users: UserWithRoles[];
  roles: RoleWithUserCount[];
}

export async function getSettingsPageData(): Promise<SettingsPageData> {
  try {
    const [users, roles] = await Promise.all([
      prisma.user.findMany({
        include: {
          roles: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.role.findMany({
        include: {
          _count: {
            select: { users: true },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return { users, roles };
  } catch (error) {
      console.error("Failed to get settings page data:", error);
      throw new Error("Could not load settings. Please try again later.");
  }
}

// User-related actions
export async function updateUserRoles(
  userId: string,
  roleIds: string[]
): Promise<User> {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          set: roleIds.map((id) => ({ id })),
        },
      },
      include: { roles: true }
    });

    await logAudit('USER_ROLE_UPDATE', {
        targetId: userId,
        targetType: 'USER',
        details: { newRoles: updatedUser.roles.map(r => r.name) }
    });

    revalidatePath("/settings");
    return updatedUser;
  } catch (error) {
      console.error("Failed to update user roles:", error);
      throw new Error("An unexpected error occurred while updating roles.");
  }
}

// Helper function for duplicate checks
async function checkUserDuplicates(email: string, phoneNumber: string, userIdToExclude?: string) {
    const OR = [];
    if (email) OR.push({ email: { equals: email, mode: 'insensitive' as const } });
    if (phoneNumber) OR.push({ phoneNumber });

    const where: Prisma.UserWhereInput = { OR };
    if (userIdToExclude) {
        where.NOT = { id: userIdToExclude };
    }

    const existingUser = await prisma.user.findFirst({ where });
    if (existingUser) {
        if (existingUser.email?.toLowerCase() === email.toLowerCase()) return `Email is already in use by user ${existingUser.name}.`;
        if (existingUser.phoneNumber === phoneNumber) return `Phone number is already in use by user ${existingUser.name}.`;
    }
    
    const existingMember = await prisma.member.findFirst({ where: { OR } });
    if (existingMember) {
        if (existingMember.email?.toLowerCase() === email.toLowerCase()) return `Email is already in use by member ${existingMember.fullName}.`;
        if (existingMember.phoneNumber === phoneNumber) return `Phone number is already in use by member ${existingMember.fullName}.`;
    }
    
    return null;
}

export async function registerUserByAdmin(
  data: any,
  roleIds: string[],
): Promise<{ success: boolean; user?: User, error?: string; }> {
  try {
    if (!data.email || !data.password || !data.phoneNumber) {
        return { success: false, error: 'Email, password, and phone number are required.' };
    }
     if (!/^09\d{8}$/.test(data.phoneNumber)) {
      return { success: false, error: 'Phone number must be 10 digits and start with 09.' };
    }

    const duplicateError = await checkUserDuplicates(data.email, data.phoneNumber);
    if (duplicateError) {
        return { success: false, error: duplicateError };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const newUser = await prisma.user.create({
      data: {
        name: `${data.firstName} ${data.lastName}`,
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        password: hashedPassword,
        roles: {
          connect: roleIds.map((id) => ({ id })),
        },
      },
    });

    await logAudit('MEMBER_CREATE', { // Note: using MEMBER_CREATE for admin user creation as well for simplicity
        targetId: newUser.id,
        targetType: 'USER',
        details: { name: newUser.name, email: newUser.email }
    });

    revalidatePath("/settings");
    return { success: true, user: newUser };
  } catch (error) {
    console.error("Error during user registration:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('email')) return { success: false, error: 'This email is already registered.' };
        if (target.includes('phoneNumber')) return { success: false, error: 'This phone number is already registered.' };
    }
    return { success: false, error: "An unexpected error occurred during registration." };
  }
}

// Role-related actions
export type RoleInput = Omit<Role, "id" | "createdAt" | "updatedAt">;

export async function createOrUpdateRole(
  data: Partial<RoleInput> & { id?: string }
): Promise<Role> {
  try {
    const { id, ...roleData } = data;
    
    const permissionsString = Array.isArray(roleData.permissions)
      ? roleData.permissions.join(',')
      : roleData.permissions || '';

    const dataToSave = {
      ...roleData,
      permissions: permissionsString,
    };

    if (id) {
      const updatedRole = await prisma.role.update({
        where: { id },
        data: dataToSave,
      });
      await logAudit('ROLE_UPDATE', { targetId: id, targetType: 'ROLE', details: { name: updatedRole.name } });
      revalidatePath("/settings");
      return updatedRole;
    } else {
      const newRole = await prisma.role.create({
        data: dataToSave as RoleInput,
      });
      await logAudit('ROLE_CREATE', { targetId: newRole.id, targetType: 'ROLE', details: { name: newRole.name } });
      revalidatePath("/settings");
      return newRole;
    }
  } catch (error) {
    console.error('Failed to create or update role:', error);
    throw new Error('An unexpected error occurred while saving the role.');
  }
}


export async function deleteRole(
  roleId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return { success: false, message: 'Role not found.' };

    const usersWithRole = await prisma.user.count({
      where: { roles: { some: { id: roleId } } },
    });

    if (usersWithRole > 0) {
      return {
        success: false,
        message:
          "Cannot delete role. It is currently assigned to one or more users.",
      };
    }

    await prisma.role.delete({ where: { id: roleId } });
    await logAudit('ROLE_DELETE', { targetId: roleId, targetType: 'ROLE', details: { name: role.name } });
    revalidatePath("/settings");
    return { success: true, message: "Role deleted successfully." };
  } catch (error) {
    console.error("Failed to delete role:", error);
    return { success: false, message: "An unexpected error occurred while deleting the role." };
  }
}

// Permission-related actions
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) return [];

    const permissions = new Set<string>();
    user.roles.forEach((role) => {
      if (typeof role.permissions === 'string') {
          role.permissions.split(',').forEach((permission) => {
              if (permission) permissions.add(permission);
          });
      }
    });
    
    if (user.roles.some((role) => role.name === "Admin")) {
      permissionsList.forEach((p) => permissions.add(p.id));
    }


    return Array.from(permissions);
  } catch (error) {
      console.error('Failed to get user permissions:', error);
      return [];
  }
}
