'use server';

import prisma from '@/lib/prisma';
import type { Prisma, School } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import type { AuthUser } from '@/types';

export type SchoolWithMemberCount = School & {
  _count: {
    members: number;
  };
};

export async function getSchoolsWithMemberCount(user: AuthUser): Promise<SchoolWithMemberCount[]> {
  try {
    const prismaOptions: Prisma.SchoolFindManyArgs = {
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        name: 'asc',
      }
    };
    
    // Check for a restrictive permission
    if (user.permissions && !user.permissions.includes('view_all_schools')) {
        // This is where the logic for school-specific filtering would go.
        // It requires a link between a User and a School in the database schema.
        // For now, we'll return an empty list to enforce the security boundary.
        // TODO: Update this once the User model has a 'schoolId' field.
        // For example: prismaOptions.where = { id: user.schoolId };
        return []; 
    }

    const schools = await prisma.school.findMany(prismaOptions);
    return schools;
  } catch (error) {
    console.error("Failed to fetch schools:", error);
    return [];
  }
}

export async function addSchool(data: Omit<School, 'id'>): Promise<School> {
  const newSchool = await prisma.school.create({
    data,
  });
  revalidatePath('/schools');
  return newSchool;
}

export async function updateSchool(id: string, data: Partial<Omit<School, 'id'>>): Promise<School> {
  const updatedSchool = await prisma.school.update({
    where: { id },
    data,
  });
  revalidatePath('/schools');
  return updatedSchool;
}

export async function deleteSchool(id: string): Promise<{ success: boolean, message: string }> {
  const memberCount = await prisma.member.count({
    where: { schoolId: id },
  });

  if (memberCount > 0) {
    return { success: false, message: 'Cannot delete school with active members. Please reassign or remove members first.' };
  }

  await prisma.school.delete({
    where: { id },
  });

  revalidatePath('/schools');
  return { success: true, message: 'School deleted successfully.' };
}
