
'use server';

import prisma from '@/lib/prisma';
import type { Prisma, School } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export type SchoolWithMemberCount = School & {
  _count: {
    members: number;
  };
};

export async function getSchoolsWithMemberCount(): Promise<SchoolWithMemberCount[]> {
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
