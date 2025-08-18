
'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface LoanSettings {
    serviceFee: number;
    insuranceFeePercentage: number;
}

const SERVICE_FEE_KEY = 'loan_service_fee';
const INSURANCE_FEE_KEY = 'loan_insurance_fee_percentage';

export async function getLoanSettings(): Promise<LoanSettings> {
    const settings = await prisma.systemSetting.findMany({
        where: {
            key: {
                in: [SERVICE_FEE_KEY, INSURANCE_FEE_KEY]
            }
        }
    });

    const serviceFeeSetting = settings.find(s => s.key === SERVICE_FEE_KEY);
    const insuranceFeeSetting = settings.find(s => s.key === INSURANCE_FEE_KEY);

    return {
        serviceFee: serviceFeeSetting ? parseFloat(serviceFeeSetting.value) : 15, // Default 15
        insuranceFeePercentage: insuranceFeeSetting ? parseFloat(insuranceFeeSetting.value) : 1, // Default 1%
    };
}

export async function updateLoanSettings(data: LoanSettings): Promise<void> {
    const { serviceFee, insuranceFeePercentage } = data;

    const serviceFeeUpdate = prisma.systemSetting.upsert({
        where: { key: SERVICE_FEE_KEY },
        update: { value: serviceFee.toString() },
        create: { key: SERVICE_FEE_KEY, value: serviceFee.toString(), description: 'Flat service fee for regular loans.' }
    });

    const insuranceFeeUpdate = prisma.systemSetting.upsert({
        where: { key: INSURANCE_FEE_KEY },
        update: { value: insuranceFeePercentage.toString() },
        create: { key: INSURANCE_FEE_KEY, value: insuranceFeePercentage.toString(), description: 'Insurance fee percentage for regular loans.' }
    });

    await prisma.$transaction([serviceFeeUpdate, insuranceFeeUpdate]);

    revalidatePath('/loan-settings');
    revalidatePath('/loans');
}
