
'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export interface ImportedMember {
    MemberID: string;
    MemberFullName: string;
    InitialSavingsBalance: number;
    SchoolID: string;
    Salary?: number;
}

export async function getImportPrerequisites() {
    const schools = await prisma.school.findMany({ select: { id: true }});
    const members = await prisma.member.findMany({ select: { id: true }});
    return {
        existingSchoolIds: new Set(schools.map(s => s.id)),
        existingMemberIds: new Set(members.map(m => m.id)),
    }
}

export async function importMembers(members: ImportedMember[]): Promise<{ success: boolean; message: string }> {
    if (!members || members.length === 0) {
        return { success: false, message: 'No valid member data provided for import.' };
    }
    
    // Find a default savings account type, e.g., "Regular Savings"
    const defaultSavingType = await prisma.savingAccountType.findFirst({
        where: { name: { contains: 'Regular', mode: 'insensitive' } }
    });

    if (!defaultSavingType) {
        return { success: false, message: 'Could not find a default "Regular Savings" account type. Please create one before importing members.' };
    }

    const membersToCreate = [];
    for (const m of members) {
        const temporaryPassword = '123456';
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
        membersToCreate.push({
            id: m.MemberID,
            fullName: m.MemberFullName,
            email: `${m.MemberID}@academinvest.com`, // Create a placeholder email
            password: hashedPassword,
            mustChangePassword: true,
            sex: 'Male' as 'Male' | 'Female', // Default value
            phoneNumber: '0900000000', // Default value
            schoolId: m.SchoolID,
            joinDate: new Date(),
            status: 'active' as 'active' | 'inactive',
            salary: m.Salary,
        });
    }
    
    const result = await prisma.member.createMany({
        data: membersToCreate,
        skipDuplicates: true,
    });
    
    const createdCount = result.count;

    if (createdCount > 0) {
        // Now create the default saving account for the newly created members
        const createdMemberIds = membersToCreate.slice(0, createdCount).map(m => m.id);
        const savingAccountsToCreate = createdMemberIds.map(memberId => {
            const importedMember = members.find(m => m.MemberID === memberId);
            return {
                memberId: memberId,
                savingAccountTypeId: defaultSavingType.id,
                initialBalance: importedMember?.InitialSavingsBalance || 0,
                balance: importedMember?.InitialSavingsBalance || 0,
                accountNumber: `SA-${Date.now().toString().slice(-6)}-${memberId.slice(-2)}`,
                expectedMonthlySaving: 0 // Default, can be updated later
            };
        });
        
        await prisma.memberSavingAccount.createMany({
            data: savingAccountsToCreate,
            skipDuplicates: true,
        });
    }

    revalidatePath('/members');
    revalidatePath('/savings-accounts');

    const skippedCount = members.length - createdCount;
    let message = `Successfully imported ${createdCount} new members and created default savings accounts.`;
    if (skippedCount > 0) {
        message += ` ${skippedCount} member(s) were skipped as they already exist.`;
    }

    return { success: true, message };
}
