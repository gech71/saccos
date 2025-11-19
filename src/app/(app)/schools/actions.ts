

'use server';

import prisma from '@/lib/prisma';
import type { Prisma, School } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authorization';

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
    throw new Error("Could not load schools data.");
  }
}

export async function addSchool(data: Omit<School, 'id' | '_count'>): Promise<{ success: boolean; error?: string }> {
  await requirePermission('school:create');
  try {
    await prisma.school.create({
      data,
    });
    revalidatePath('/schools');
    return { success: true };
  } catch (error) {
    console.error("Failed to add school:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { success: false, error: 'A school with this ID already exists.' };
    }
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function updateSchool(id: string, data: Partial<Omit<School, 'id' | '_count'>>): Promise<{ success: boolean; error?: string }> {
  await requirePermission('school:edit');
  try {
    await prisma.school.update({
      where: { id },
      data,
    });
    revalidatePath('/schools');
    return { success: true };
  } catch (error) {
    console.error("Failed to update school:", error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function deleteSchool(id: string): Promise<{ success: boolean, message: string }> {
  try {
    await requirePermission('school:delete');
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
  } catch(error) {
     console.error("Failed to delete school:", error);
    return { success: false, message: 'An unexpected error occurred during deletion.' };
  }
}


export async function importSchools(schools: {id: string, name: string, address?: string, contactPerson?: string}[]): Promise<{ success: boolean, message: string }> {
    if (!schools || schools.length === 0) {
        return { success: false, message: 'No school data provided for import.' };
    }
    
    let createdCount = 0;
    let skippedCount = 0;

    try {
      await requirePermission('school:create');
        for (const school of schools) {
            try {
                await prisma.school.create({
                    data: {
                        id: school.id,
                        name: school.name,
                        address: school.address,
                        contactPerson: school.contactPerson
                    }
                });
                createdCount++;
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                    skippedCount++; // ID already exists
                } else {
                    throw e; // Rethrow other errors
                }
            }
        }

        revalidatePath('/schools');
        let message = `Successfully imported ${createdCount} new schools.`;
        if (skippedCount > 0) {
            message += ` ${skippedCount} school(s) were skipped as duplicates.`;
        }
        return { success: true, message };
    } catch(error) {
        console.error("Failed during school import:", error);
        return { success: false, message: 'A critical error occurred during the import process.' };
    }
}
