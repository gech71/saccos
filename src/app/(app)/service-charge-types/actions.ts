
'use server';

import prisma from '@/lib/prisma';
import type { ServiceChargeType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/authorization';

export async function getServiceChargeTypes(): Promise<ServiceChargeType[]> {
  try {
    return prisma.serviceChargeType.findMany({
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    console.error('Failed to get service charge types:', error);
    throw new Error('Could not load service charge types. Please try again.');
  }
}

export async function addServiceChargeType(data: Omit<ServiceChargeType, 'id'>): Promise<ServiceChargeType> {
  await requirePermission('configuration:create');
  try {
    const newChargeType = await prisma.serviceChargeType.create({ data });
    revalidatePath('/service-charge-types');
    return newChargeType;
  } catch (error) {
    console.error('Failed to add service charge type:', error);
    throw new Error('An unexpected error occurred while adding the charge type.');
  }
}

export async function updateServiceChargeType(id: string, data: Partial<Omit<ServiceChargeType, 'id'>>): Promise<ServiceChargeType> {
  await requirePermission('configuration:edit');
  try {
    const updatedChargeType = await prisma.serviceChargeType.update({
      where: { id },
      data,
    });
    revalidatePath('/service-charge-types');
    return updatedChargeType;
  } catch (error) {
    console.error('Failed to update service charge type:', error);
    throw new Error('An unexpected error occurred while updating the charge type.');
  }
}

export async function deleteServiceChargeType(id: string): Promise<{ success: boolean; message: string }> {
  await requirePermission('configuration:delete');
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
    return { success: false, message: 'An unexpected error occurred while deleting the charge type.' };
  }
}
