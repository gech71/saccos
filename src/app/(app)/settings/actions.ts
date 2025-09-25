

"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { User, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import axios from "axios";
import { permissionsList } from "./permissions";
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  nameid?: string;
  sub?: string;
  email: string;
  unique_name: string;
  role: string | string[];
  nbf: number;
  exp: number;
  iat: number;
}

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

export async function syncUserOnLogin(
  userId: string,
  name: string,
  email: string
) {
  try {
    const normalizedEmail = email.toLowerCase();
    
    const userByUserId = await prisma.user.findUnique({
      where: { userId },
      include: { roles: true },
    });

    if (userByUserId) {
      const potentialConflict = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          NOT: { userId: userId },
        },
      });

      if (potentialConflict) {
        console.warn(
          `Login attempt for userId ${userId} with email ${normalizedEmail}, but this email is already registered to user ${potentialConflict.id}. Only updating name.`
        );
        return prisma.user.update({
          where: { userId },
          data: { name },
          include: { roles: true },
        });
      }

      return prisma.user.update({
        where: { userId },
        data: { name, email: normalizedEmail },
        include: { roles: true },
      });
    }

    const userByEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { roles: true },
    });

    if (userByEmail) {
      return prisma.user.update({
        where: { email: normalizedEmail },
        data: { userId, name },
        include: { roles: true },
      });
    }

    return prisma.user.create({
      data: {
        userId,
        name,
        email: normalizedEmail,
        roles: {
          connectOrCreate: {
            where: { name: "Staff" },
            create: {
              name: "Staff",
              description: "Regular staff member",
              permissions: [
                "dashboard:view",
                "school:view",
                "member:view",
                "saving:view",
              ].join(','),
            },
          },
        },
      },
      include: {
        roles: true,
      },
    });
  } catch (error) {
      console.error("Failed to sync user on login:", error);
      throw new Error("An error occurred during user synchronization.");
  }
}

export async function registerUserByAdmin(
  data: any,
  roleIds: string[],
  token: string | null
) {
  if (!token) {
    throw new Error(
      "Authentication token is missing. You must be logged in to register a user."
    );
  }

  const authApiBaseUrl = process.env.AUTH_API_BASE_URL;

  try {
    const registerResponse = await axios.post(
      `${authApiBaseUrl}/api/Auth/register`,
      {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        password: data.password,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const responseData = registerResponse.data;

    if (!responseData || !responseData.isSuccess) {
      const errorMessage =
        responseData?.errors?.join(" ") ||
        responseData?.message ||
        "External registration failed. Please ensure the password meets complexity requirements and the user details are unique.";
      throw new Error(errorMessage);
    }

    let externalUserId: string | undefined;

    if (responseData.accessToken) {
      try {
        const decoded = jwtDecode<DecodedToken>(responseData.accessToken);
        externalUserId = decoded.sub || decoded.nameid;
      } catch (e) {
        console.error(
          "Failed to decode access token from registration response:",
          e
        );
        throw new Error(
          "Received an invalid token from the authentication service."
        );
      }
    } else {
      externalUserId =
        responseData.userId || responseData.id || responseData.sub;
    }

    if (!externalUserId) {
      console.log(
        "Full auth service response (for debugging):",
        JSON.stringify(responseData, null, 2)
      );
      const availableKeys = Object.keys(responseData).join(", ");
      const errorMessage = `Auth service succeeded but did not return a user ID. Available keys in response: [${availableKeys}]. Check server logs for full response.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const newUser = await prisma.user.create({
      data: {
        userId: externalUserId,
        name: `${data.firstName} ${data.lastName}`,
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        roles: {
          connect: roleIds.map((id) => ({ id })),
        },
      },
    });

    revalidatePath("/settings");
    return newUser;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data;
      const message =
        (Array.isArray(responseData?.errors) &&
          responseData.errors.join(" ")) ||
        responseData?.message ||
        "An unknown error occurred with the authentication service.";
      console.error("Error during external auth registration:", message);
      throw new Error(message);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const fields = (error.meta?.target as string[]) || ["field"];
        const fieldName = fields.join(", ");
        const message = `A user with this ${fieldName} already exists in the local database. This could be due to a previous failed registration.`;
        console.error("Prisma unique constraint error:", message);
        throw new Error(message);
      }
    }

    console.error("Generic Error during registration:", error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }

    throw new Error("An unexpected error occurred during registration.");
  }
}

// Role-related actions
export type RoleInput = Omit<Role, "id">;

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
      where: { userId },
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
