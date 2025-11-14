"use server";

import prisma from "@/lib/prisma";
import type { User, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { permissionsList } from "./permissions";
import bcrypt from 'bcryptjs';

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
    });
    revalidatePath("/settings");
    return updatedUser;
  } catch (error) {
      console.error("Failed to update user roles:", error);
      throw new Error("An unexpected error occurred while updating roles.");
  }
}

export async function registerUserByAdmin(
  data: any,
  roleIds: string[],
) {
  try {
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

    revalidatePath("/settings");
    return newUser;
  } catch (error) {
    console.error("Error during user registration:", error);
    throw new Error("An unexpected error occurred during registration.");
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
      revalidatePath("/settings");
      return updatedRole;
    } else {
      const newRole = await prisma.role.create({
        data: dataToSave as RoleInput,
      });
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
