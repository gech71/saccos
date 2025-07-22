

'use server';

import prisma from '@/lib/prisma';
import type { Member, Prisma, SavingAccountType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// This is the shape of the data the client page will receive
export interface MemberWithDetails extends Member {
    school: { name: string } | null;
    memberSavingAccounts: ({
        savingAccountType: { name: string; };
    } & Prisma.MemberSavingAccountGetPayload<{}>)[];
    shareCommitments: {
        shareTypeId: string;
        shareTypeName: string;
        monthlyCommittedAmount: number;
    }[];
    totalSavingsBalance: number;
    address: Prisma.AddressGetPayload<{}> | null;
    emergencyContact: Prisma.EmergencyContactGetPayload<{}> | null;
}


// Data type for the combined data needed by the page
export interface MembersPageData {
  members: MemberWithDetails[];
  schools: { id: string; name: string }[];
  shareTypes: { id: string; name: string; valuePerShare: number }[];
  savingAccountTypes: SavingAccountType[];
}

export async function getMembersPageData(): Promise<MembersPageData> {
    const members = await prisma.member.findMany({
        include: {
            school: { select: { name: true } },
            memberSavingAccounts: {
                include: {
                    savingAccountType: { select: { name: true } }
                }
            },
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
    const savingAccountTypes = await prisma.savingAccountType.findMany({ select: { id: true, name: true, contributionType: true, contributionValue: true, interestRate: true }, orderBy: {name: 'asc'} });

    // Map members to a more usable format for the client
    const formattedMembers: MemberWithDetails[] = members.map(member => ({
        ...member,
        joinDate: member.joinDate.toISOString(), // Ensure date is a string
        shareCommitments: member.shareCommitments.map(sc => ({
            shareTypeId: sc.shareTypeId,
            shareTypeName: sc.shareType.name,
            monthlyCommittedAmount: sc.monthlyCommittedAmount
        })),
        totalSavingsBalance: member.memberSavingAccounts.reduce((sum, acc) => sum + acc.balance, 0),
    }));

    return {
        members: formattedMembers,
        schools,
        shareTypes,
        savingAccountTypes,
    };
}

// Type for creating/updating a member, received from the client
export type MemberInput = Omit<Member, 'schoolName' | 'savingAccountTypeName' | 'joinDate' | 'status' | 'closureDate' | 'shareCommitments' | 'address' | 'emergencyContact' | 'memberSavingAccounts'> & {
    joinDate: string;
    salary?: number | null;
    shareCommitments?: { shareTypeId: string; monthlyCommittedAmount: number }[];
    address?: Prisma.AddressCreateWithoutMemberInput;
    emergencyContact?: Prisma.EmergencyContactCreateWithoutMemberInput;
};


export async function addMember(data: MemberInput): Promise<Member> {
    const { id, address, emergencyContact, shareCommitments, ...memberData } = data;

    // Check for uniqueness of member ID
    const existingMemberById = await prisma.member.findUnique({
        where: { id: id },
    });
    if (existingMemberById) {
        throw new Error(`The member id already existed`);
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
    
    // Prepare a clean payload for address creation, removing relational IDs
    let cleanAddressPayload: Prisma.AddressCreateWithoutMemberInput | undefined;
    if (address && Object.values(address).some(val => val !== '' && val !== null && val !== undefined)) {
        const { id: addressId, memberId, collateralId, ...restOfAddress } = address as any;
        cleanAddressPayload = restOfAddress;
    }

    // Prepare a clean payload for emergency contact creation, removing relational IDs
    let cleanEmergencyContactPayload: Prisma.EmergencyContactCreateWithoutMemberInput | undefined;
    if (emergencyContact && Object.values(emergencyContact).some(val => val !== '' && val !== null && val !== undefined)) {
        const { id: contactId, memberId, ...restOfContact } = emergencyContact as any;
        cleanEmergencyContactPayload = restOfContact;
    }


    const newMember = await prisma.member.create({
        data: {
            id,
            ...memberData,
            status: 'active',
            joinDate: new Date(memberData.joinDate),
            address: cleanAddressPayload ? { create: cleanAddressPayload } : undefined,
            emergencyContact: cleanEmergencyContactPayload ? { create: cleanEmergencyContactPayload } : undefined,
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
    const { address, emergencyContact, shareCommitments, salary, ...memberData } = data;

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
            salary,
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
  savingAccountTypeId: string;
  members: { memberId: string, fullName: string; savingsBalance: number; schoolId: string }[];
}): Promise<{ success: boolean; message: string, createdCount: number }> {
    const { savingAccountTypeId, members } = data;

    if (!savingAccountTypeId || !members.length) {
        return { success: false, message: 'Saving Account Type, and at least one member are required.', createdCount: 0 };
    }

    const savingAccountType = await prisma.savingAccountType.findUnique({
        where: { id: savingAccountTypeId },
    });

    if (!savingAccountType) {
        return { success: false, message: 'Invalid Saving Account Type selected.', createdCount: 0 };
    }
    
    const existingMemberIds = (await prisma.member.findMany({
        where: { id: { in: members.map(m => m.memberId) } },
        select: { id: true }
    })).map(m => m.id);
    
    const membersToCreate = members.filter(m => !existingMemberIds.includes(m.memberId));
    const skippedCount = members.length - membersToCreate.length;

    if (membersToCreate.length === 0) {
        return { success: true, message: `Import finished. ${skippedCount} member(s) were skipped as they already exist.`, createdCount: 0 };
    }

    let createdCount = 0;
    
    await prisma.$transaction(async (tx) => {
      for (const [i, member] of membersToCreate.entries()) {
        const uniqueSuffix = `${Date.now()}${i}`;
        let expectedSaving = 0;
        if (savingAccountType.contributionType === 'FIXED') {
            expectedSaving = savingAccountType.contributionValue;
        }

        const newMember = await tx.member.create({
          data: {
            id: member.memberId,
            fullName: member.fullName,
            email: `${member.memberId}.${uniqueSuffix}@placeholder.email`,
            sex: 'Male', // Default value
            phoneNumber: `0000000000${uniqueSuffix}`, // Placeholder phone
            schoolId: member.schoolId,
            joinDate: new Date(),
            status: 'active',
            salary: 0,
          }
        });

        const newSavingAccount = await tx.memberSavingAccount.create({
          data: {
            memberId: newMember.id,
            savingAccountTypeId: savingAccountTypeId,
            accountNumber: `IMP-${newMember.id.slice(-6)}`,
            expectedMonthlySaving: expectedSaving,
            balance: 0, // Set initial balance to 0, it will be updated by the approved deposit.
          }
        });
        
        if (member.savingsBalance > 0) {
            await tx.saving.create({
                data: {
                    memberId: newMember.id,
                    memberSavingAccountId: newSavingAccount.id,
                    amount: member.savingsBalance,
                    date: new Date(),
                    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
                    transactionType: 'deposit',
                    status: 'approved', // Initial imported balances are auto-approved
                    notes: `Initial balance from import.`,
                    depositMode: 'Bank',
                    sourceName: 'System Import',
                },
            });
             
             await tx.memberSavingAccount.update({
                where: { id: newSavingAccount.id },
                data: { balance: member.savingsBalance },
             });
        }
        
        createdCount++;
      }
    }, {
        timeout: 30000 // Set timeout to 30 seconds
    });

    revalidatePath('/members');
    return { 
        success: true, 
        message: `Successfully imported ${createdCount} new members. ${skippedCount > 0 ? `${skippedCount} member(s) were skipped as duplicates.` : ''}`.trim(),
        createdCount: createdCount 
    };
}
