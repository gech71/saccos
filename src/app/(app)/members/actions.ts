
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
export type MemberInput = Omit<Member, 'id' | 'schoolName' | 'savingAccountTypeName' | 'joinDate' | 'status' | 'closureDate' | 'shareCommitments' | 'address' | 'emergencyContact' > & {
    joinDate: string;
    shareCommitments?: { shareTypeId: string; monthlyCommittedAmount: number }[];
    address?: Prisma.AddressCreateWithoutMemberInput;
    emergencyContact?: Prisma.EmergencyContactCreateWithoutMemberInput;
};


export async function addMember(data: MemberInput): Promise<Member> {
    const { address, emergencyContact, shareCommitments, ...memberData } = data;

    // Check for uniqueness of savingsAccountNumber
    if (memberData.savingsAccountNumber) {
        const existingMemberByAccount = await prisma.member.findUnique({
            where: { savingsAccountNumber: memberData.savingsAccountNumber },
        });
        if (existingMemberByAccount) {
            throw new Error(`A member with savings account number '${memberData.savingsAccountNumber}' already exists.`);
        }
    }
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
            ...memberData,
            status: 'active',
            joinDate: new Date(memberData.joinDate),
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

    // Uniqueness checks for email and savings account number
    if (memberData.savingsAccountNumber) {
        const existingMember = await prisma.member.findUnique({
            where: { savingsAccountNumber: memberData.savingsAccountNumber },
        });
        if (existingMember && existingMember.id !== id) {
            throw new Error(`Savings account number '${memberData.savingsAccountNumber}' is already in use by another member.`);
        }
    }
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
