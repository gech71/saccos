'use server';

import prisma from '@/lib/prisma';
import type { ServiceChargeType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getServiceChargeTypes(): Promise<ServiceChargeType[]> {
  return prisma.serviceChargeType.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function addServiceChargeType(data: Omit<ServiceChargeType, 'id'>): Promise<ServiceChargeType> {
  const newChargeType = await prisma.serviceChargeType.create({ data });
  revalidatePath('/service-charge-types');
  return newChargeType;
}

export async function updateServiceChargeType(id: string, data: Partial<Omit<ServiceChargeType, 'id'>>): Promise<ServiceChargeType> {
  const updatedChargeType = await prisma.serviceChargeType.update({
    where: { id },
    data,
  });
  revalidatePath('/service-charge-types');
  return updatedChargeType;
}

export async function deleteServiceChargeType(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const chargesWithThisType = await prisma.appliedServiceCharge.count({
      where: { serviceChargeTypeId: id },
    });

    if (chargesWithThisType > 0) {
      return { success: false, message: 'Cannot delete service charge type. It has been applied to members.' };
    }
    
    await prisma.serviceChargeType.delete({ where: { id } });
    revalidatePath('/service-charge-types');
    return { success: true, message: 'Service charge type deleted successfully.' };
  } catch(error) {
    console.error("Failed to delete service charge type:", error);
    return { success: false, message: 'An unexpected error occurred.' };
  }
}
