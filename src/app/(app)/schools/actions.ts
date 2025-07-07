
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

export type SchoolImportData = {
  id: string;
  name: string;
  address?: string | null;
  contactPerson?: string | null;
};

export async function importSchools(schoolsData: SchoolImportData[]): Promise<{ success: boolean; message: string; errors: string[] }> {
  const errors: string[] = [];
  let processedCount = 0;

  for (const school of schoolsData) {
    if (!school.id || !school.name) {
      errors.push(`Skipping row with missing ID or Name: ${JSON.stringify(school)}`);
      continue;
    }

    try {
      await prisma.school.upsert({
        where: { id: school.id },
        update: {
          name: school.name,
          address: school.address,
          contactPerson: school.contactPerson,
        },
        create: {
          id: school.id,
          name: school.name,
          address: school.address,
          contactPerson: school.contactPerson,
        },
      });
      processedCount++;
    } catch (e) {
      if (e instanceof Error) {
        errors.push(`Error processing school ID ${school.id}: ${e.message}`);
      } else {
        errors.push(`An unknown error occurred for school ID ${school.id}`);
      }
    }
  }

  revalidatePath('/schools');
  const message = `Import complete. Processed ${processedCount} schools.`;
  return { success: errors.length === 0, message, errors };
}
