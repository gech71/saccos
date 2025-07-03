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
}

// User-related actions
export async function updateUserRoles(
  userId: string,
  roleIds: string[]
): Promise<User> {
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
}

export async function syncUserOnLogin(
  userId: string,
  name: string,
  email: string
) {
  const user = await prisma.user.upsert({
    where: { userId },
    update: { name, email },
    create: {
      userId,
      name,
      email,
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
            ],
          },
        },
      },
    },
    include: {
      roles: true,
    },
  });
  return user;
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
    // Step 1: Register user with the external auth provider
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

    // Step 2: Validate the response from the auth service
    const responseData = registerResponse.data;

    if (!responseData || !responseData.isSuccess) {
      const errorMessage =
        responseData?.errors?.join(" ") ||
        responseData?.message ||
        "External registration failed. Please ensure the password meets complexity requirements and the user details are unique.";
      throw new Error(errorMessage);
    }

    // Step 3: Extract the new user's ID from the response.
    // It might be in a token or directly in the response body.
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
      // Fallback to checking direct properties if no token is present
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

    // Step 4: Save the new user to the local application database
    const newUser = await prisma.user.create({
      data: {
        userId: externalUserId,
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
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
    // Step 5: Provide detailed error handling
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

    // Fallback for any other type of error
    console.error("Generic Error during registration:", error);
    if (error instanceof Error) {
      // Re-throw the specific error message to be displayed to the user.
      throw new Error(error.message);
    }

    // Fallback for non-Error objects
    throw new Error("An unexpected error occurred during registration.");
  }
}

// Role-related actions
export type RoleInput = Omit<Role, "id">;

export async function createOrUpdateRole(
  data: Partial<RoleInput> & { id?: string }
): Promise<Role> {
  const { id, ...roleData } = data;

  if (id) {
    // Update
    const updatedRole = await prisma.role.update({
      where: { id },
      data: roleData,
    });
    revalidatePath("/settings");
    return updatedRole;
  } else {
    // Create
    const newRole = await prisma.role.create({
      data: roleData as RoleInput,
    });
    revalidatePath("/settings");
    return newRole;
  }
}

export async function deleteRole(
  roleId: string
): Promise<{ success: boolean; message: string }> {
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

  try {
    await prisma.role.delete({ where: { id: roleId } });
    revalidatePath("/settings");
    return { success: true, message: "Role deleted successfully." };
  } catch (error) {
    console.error("Failed to delete role:", error);
    return { success: false, message: "An unexpected error occurred." };
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
  user.roles.forEach((role) => {
    role.permissions.forEach((permission) => {
      permissions.add(permission);
    });
  });

  return Array.from(permissions);
}
