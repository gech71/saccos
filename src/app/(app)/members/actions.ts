
'use server';

import prisma from '@/lib/prisma';
import type { Member, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// This is the shape of the data the client page will receive
export interface MemberWithDetails extends Member {
    school: { name: string } | null;
    savingAccountType: { name: string } | null;
    shareCommitments: {
        shareTypeId: string;
        shareTypeName: string;
        monthlyCommittedAmount: number;
    }[];
    savingAccountTypeName?: string; // Add this for easier display
}


// Data type for the combined data needed by the page
export interface MembersPageData {
  members: MemberWithDetails[];
  schools: { id: string; name: string }[];
  shareTypes: { id: string; name: string; valuePerShare: number }[];
  savingAccountTypes: { id: string; name: string, expectedMonthlyContribution: number | null, interestRate: number }[];
}

export async function getMembersPageData(): Promise<MembersPageData> {
    const members = await prisma.member.findMany({
        include: {
            school: { select: { name: true } },
            savingAccountType: { select: { name: true } },
            shareCommitments: {
                include: {
                    shareType: { select: { name: true, valuePerShare: true } }
                }
            },
            address: true,
            emergencyContact: true,
        },
        orderBy: { fullName: 'asc' }
    });

    const schools = await prisma.school.findMany({ select: { id: true, name: true }, orderBy: {name: 'asc'} });
    const shareTypes = await prisma.shareType.findMany({ select: { id: true, name: true, valuePerShare: true }, orderBy: {name: 'asc'} });
    const savingAccountTypes = await prisma.savingAccountType.findMany({ select: { id: true, name: true, expectedMonthlyContribution: true, interestRate: true }, orderBy: {name: 'asc'} });

    // Map members to a more usable format for the client
    const formattedMembers: MemberWithDetails[] = members.map(member => ({
        ...member,
        joinDate: member.joinDate.toISOString(), // Ensure date is a string
        shareCommitments: member.shareCommitments.map(sc => ({
            shareTypeId: sc.shareTypeId,
            shareTypeName: sc.shareType.name,
            monthlyCommittedAmount: sc.monthlyCommittedAmount
        })),
        savingAccountTypeName: member.savingAccountType?.name
    }));

    return {
        members: formattedMembers,
        schools,
        shareTypes,
        savingAccountTypes,
    };
}

// Type for creating/updating a member, received from the client
export type MemberInput = Omit<Member, 'schoolName' | 'savingAccountTypeName' | 'joinDate' | 'status' | 'closureDate' | 'shareCommitments' | 'address' | 'emergencyContact' | 'savingsBalance' | 'savingsAccountNumber' | 'savingAccountTypeId' | 'expectedMonthlySaving' | 'sharesCount' > & {
    joinDate: string;
    shareCommitments?: { shareTypeId: string; monthlyCommittedAmount: number }[];
    address?: Prisma.AddressCreateWithoutMemberInput;
    emergencyContact?: Prisma.EmergencyContactCreateWithoutMemberInput;
};


export async function addMember(data: MemberInput): Promise<Member> {
    const { id, address, emergencyContact, shareCommitments, ...memberData } = data;

    // Check for uniqueness of email
    if (memberData.email) {
        const existingMemberByEmail = await prisma.member.findUnique({
            where: { email: memberData.email },
        });
        if (existingMemberByEmail) {
            throw new Error(`A member with email '${memberData.email}' already exists.`);
        }
    }

    const newMember = await prisma.member.create({
        data: {
            id,
            ...memberData,
            status: 'active',
            joinDate: new Date(memberData.joinDate),
            // Default values for fields that will be managed elsewhere
            savingsBalance: 0,
            sharesCount: 0,
            expectedMonthlySaving: 0,
            address: address ? { create: address } : undefined,
            emergencyContact: emergencyContact ? { create: emergencyContact } : undefined,
            shareCommitments: shareCommitments ? {
                create: shareCommitments.map(sc => ({
                    monthlyCommittedAmount: sc.monthlyCommittedAmount,
                    shareType: {
                        connect: { id: sc.shareTypeId }
                    }
                }))
            } : undefined,
        },
    });
    revalidatePath('/members');
    return newMember;
}

export async function updateMember(id: string, data: MemberInput): Promise<Member> {
    const { address, emergencyContact, shareCommitments, ...memberData } = data;

    // Uniqueness checks for email
    if (memberData.email) {
        const existingMemberByEmail = await prisma.member.findUnique({
            where: { email: memberData.email },
        });
        if (existingMemberByEmail && existingMemberByEmail.id !== id) {
            throw new Error(`Email '${memberData.email}' is already in use by another member.`);
        }
    }
    
    const existingMember = await prisma.member.findUnique({
      where: { id },
      select: { address: true, emergencyContact: true },
    });
    
    // Prepare a clean payload for address upsert, removing relational IDs
    let cleanAddressPayload: Prisma.AddressCreateWithoutMemberInput | undefined;
    if (address && Object.values(address).some(val => val !== '' && val !== null && val !== undefined)) {
        const { id: addressId, memberId, collateralId, ...restOfAddress } = address as any;
        cleanAddressPayload = restOfAddress;
    }

    // Prepare a clean payload for emergency contact upsert, removing relational IDs
    let cleanEmergencyContactPayload: Prisma.EmergencyContactCreateWithoutMemberInput | undefined;
    if (emergencyContact && Object.values(emergencyContact).some(val => val !== '' && val !== null && val !== undefined)) {
        const { id: contactId, memberId, ...restOfContact } = emergencyContact as any;
        cleanEmergencyContactPayload = restOfContact;
    }

    const addressUpdate = cleanAddressPayload
        ? { upsert: { create: cleanAddressPayload, update: cleanAddressPayload } }
        : (existingMember?.address ? { delete: true } : undefined);

    const emergencyContactUpdate = cleanEmergencyContactPayload
        ? { upsert: { create: cleanEmergencyContactPayload, update: cleanEmergencyContactPayload } }
        : (existingMember?.emergencyContact ? { delete: true } : undefined);

    const updatedMember = await prisma.member.update({
        where: { id },
        data: {
            ...memberData,
            joinDate: new Date(memberData.joinDate),
            address: addressUpdate,
            emergencyContact: emergencyContactUpdate,
            shareCommitments: {
                 deleteMany: {},
                 create: (shareCommitments || []).map(sc => ({
                    monthlyCommittedAmount: sc.monthlyCommittedAmount,
                    shareType: {
                        connect: { id: sc.shareTypeId }
                    }
                }))
            }
        },
    });

    revalidatePath('/members');
    return updatedMember;
}


export async function deleteMember(id: string): Promise<{ success: boolean; message: string }> {
    const loanCount = await prisma.loan.count({ where: { memberId: id, status: { in: ['active', 'overdue'] } } });
    if (loanCount > 0) {
        return { success: false, message: 'Cannot delete member with active or overdue loans. Please resolve loans first.' };
    }

    try {
        await prisma.member.delete({
            where: { id },
        });
        revalidatePath('/members');
        return { success: true, message: 'Member deleted successfully.' };
    } catch (error) {
        console.error("Failed to delete member:", error);
        return { success: false, message: 'Failed to delete member. They may have related records that could not be deleted.' };
    }
}

export async function importMembers(data: {
  schoolId: string;
  savingAccountTypeId: string;
  members: { fullName: string; savingsBalance: number }[];
}): Promise<{ success: boolean; message: string, createdCount: number }> {
    const { schoolId, savingAccountTypeId, members } = data;

    if (!schoolId || !savingAccountTypeId || !members.length) {
        return { success: false, message: 'School, Saving Account Type, and at least one member are required.', createdCount: 0 };
    }

    const savingAccountType = await prisma.savingAccountType.findUnique({
        where: { id: savingAccountTypeId },
    });

    if (!savingAccountType) {
        return { success: false, message: 'Invalid Saving Account Type selected.', createdCount: 0 };
    }
    
    const existingMemberNames = (await prisma.member.findMany({
        where: {
            schoolId: schoolId,
            fullName: { in: members.map(m => m.fullName) }
        },
        select: { fullName: true }
    })).map(m => m.fullName.toLowerCase());
    
    const membersToCreate = members.filter(m => !existingMemberNames.includes(m.fullName.toLowerCase()));
    const skippedCount = members.length - membersToCreate.length;

    if (membersToCreate.length === 0) {
        return { success: true, message: `Import finished. ${skippedCount} member(s) were skipped as they already exist in this school.`, createdCount: 0 };
    }

    const newMembersData = membersToCreate.map((member, i) => {
        const uniqueSuffix = `${Date.now()}${i}`;
        return {
            id: `imported-${uniqueSuffix}`,
            fullName: member.fullName,
            email: `imported.${uniqueSuffix}@placeholder.email`,
            sex: 'Male' as 'Male' | 'Female' | 'Other',
            phoneNumber: '0000000000',
            schoolId: schoolId,
            joinDate: new Date(),
            savingsBalance: member.savingsBalance,
            savingsAccountNumber: `IMP-${uniqueSuffix}`,
            sharesCount: 0,
            savingAccountTypeId: savingAccountTypeId,
            expectedMonthlySaving: savingAccountType.expectedMonthlyContribution ?? 0,
            status: 'active' as 'active' | 'inactive',
        };
    });

    try {
        const result = await prisma.member.createMany({
            data: newMembersData,
            skipDuplicates: true,
        });

        revalidatePath('/members');
        return { 
            success: true, 
            message: `Successfully imported ${result.count} new members. ${skippedCount > 0 ? `${skippedCount} member(s) were skipped as duplicates.` : ''}`.trim(),
            createdCount: result.count 
        };
    } catch (error) {
        console.error("Failed to import members:", error);
        return { success: false, message: 'An error occurred during the database operation.', createdCount: 0 };
    }
}
