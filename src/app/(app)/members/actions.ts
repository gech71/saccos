

'use server';

import prisma from '@/lib/prisma';
import type { Prisma, SavingAccountType, ServiceChargeType, ShareType, Member } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// This is the shape of the data the client page will receive
export interface MemberWithDetails extends Member {
    school: { name: string } | null;
    memberSavingAccounts: ({
        savingAccountType: { name: string; };
    } & Prisma.MemberSavingAccountGetPayload<{}>)[];
    memberShareCommitments: ({
        shareType: { name: string; };
    } & Prisma.MemberShareCommitmentGetPayload<{}>)[];
    totalSavingsBalance: number;
    address: Prisma.AddressGetPayload<{}> | null;
    emergencyContact: Prisma.EmergencyContactGetPayload<{}> | null;
}


// Data type for the combined data needed by the page
export interface MembersPageData {
  members: MemberWithDetails[];
  schools: { id: string; name: string }[];
  shareTypes: ShareType[];
  savingAccountTypes: SavingAccountType[];
  serviceChargeTypes: ServiceChargeType[];
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
            memberShareCommitments: {
                include: {
                    shareType: { select: { name: true } }
                }
            },
            address: true,
            emergencyContact: true,
        },
        orderBy: { id: 'asc' }
    });

    const schools = await prisma.school.findMany({ select: { id: true, name: true }, orderBy: {name: 'asc'} });
    const shareTypes = await prisma.shareType.findMany({ orderBy: {name: 'asc'} });
    const savingAccountTypes = await prisma.savingAccountType.findMany({ select: { id: true, name: true, contributionType: true, contributionValue: true, interestRate: true }, orderBy: {name: 'asc'} });
    const serviceChargeTypes = await prisma.serviceChargeType.findMany({ orderBy: {name: 'asc'} });


    // Map members to a more usable format for the client
    const formattedMembers: MemberWithDetails[] = members.map(member => ({
        ...member,
        joinDate: member.joinDate.toISOString(), // Ensure date is a string
        totalSavingsBalance: member.memberSavingAccounts.reduce((sum, acc) => sum + acc.balance, 0),
    }));

    return {
        members: formattedMembers,
        schools,
        shareTypes,
        savingAccountTypes,
        serviceChargeTypes,
    };
}

// Type for creating/updating a member, received from the client
export type MemberInput = Omit<Member, 'schoolName' | 'joinDate' | 'status' | 'closureDate' | 'shareCommitments' | 'address' | 'emergencyContact' | 'memberSavingAccounts' | 'memberShareCommitments'> & {
    joinDate: string;
    salary?: number | null;
    shareCommitmentIds?: string[];
    serviceChargeIds?: string[];
    address?: Prisma.AddressCreateWithoutMemberInput;
    emergencyContact?: Prisma.EmergencyContactCreateWithoutMemberInput;
};

function validateMemberData(data: MemberInput) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (data.email && !emailRegex.test(data.email)) {
        throw new Error('Invalid email format.');
    }

    const phoneRegex = /^(09|\+2519)\d{8}$/;
    if (data.phoneNumber && !phoneRegex.test(data.phoneNumber)) {
        throw new Error('Invalid phone number format. Use 09xxxxxxxx or +2519xxxxxxxx.');
    }
}


export async function addMember(data: MemberInput): Promise<Member> {
    const { id, address, emergencyContact, shareCommitmentIds, serviceChargeIds, ...memberData } = data;

    validateMemberData(data);

    const existingMemberById = await prisma.member.findUnique({
        where: { id: id },
    });
    if (existingMemberById) {
        throw new Error(`The member id already existed`);
    }

    if (memberData.email) {
        const existingMemberByEmail = await prisma.member.findUnique({
            where: { email: memberData.email },
        });
        if (existingMemberByEmail) {
            throw new Error(`A member with email '${memberData.email}' already exists.`);
        }
    }
    
    let cleanAddressPayload: Prisma.AddressCreateWithoutMemberInput | undefined;
    if (address && Object.values(address).some(val => val !== '' && val !== null && val !== undefined)) {
        const { id: addressId, memberId, collateralId, ...restOfAddress } = address as any;
        cleanAddressPayload = restOfAddress;
    }

    let cleanEmergencyContactPayload: Prisma.EmergencyContactCreateWithoutMemberInput | undefined;
    if (emergencyContact && Object.values(emergencyContact).some(val => val !== '' && val !== null && val !== undefined)) {
        const { id: contactId, memberId, ...restOfContact } = emergencyContact as any;
        cleanEmergencyContactPayload = restOfContact;
    }

    const serviceChargesToApply = await prisma.serviceChargeType.findMany({
        where: {
            id: { in: serviceChargeIds }
        }
    });

    const shareTypesToCommit = await prisma.shareType.findMany({
        where: { id: { in: shareCommitmentIds || [] } }
    });

    const newMember = await prisma.member.create({
        data: {
            id,
            ...memberData,
            status: 'active',
            joinDate: new Date(memberData.joinDate),
            address: cleanAddressPayload ? { create: cleanAddressPayload } : undefined,
            emergencyContact: cleanEmergencyContactPayload ? { create: cleanEmergencyContactPayload } : undefined,
            memberShareCommitments: {
                create: shareTypesToCommit.map(st => ({
                    shareTypeId: st.id,
                    totalCommittedAmount: st.totalAmount
                }))
            },
            appliedServiceCharges: {
                create: serviceChargesToApply.map(sc => ({
                    serviceChargeTypeId: sc.id,
                    amountCharged: sc.amount,
                    dateApplied: new Date(),
                    status: 'pending',
                    notes: 'Registration Charge'
                }))
            }
        },
    });
    
    const school = await prisma.school.findUnique({ where: {id: newMember.schoolId }});
    if (school) {
        await prisma.schoolHistory.create({
            data: {
                memberId: newMember.id,
                schoolId: school.id,
                schoolName: school.name,
                startDate: newMember.joinDate,
                endDate: null,
            }
        });
    }

    revalidatePath('/members');
    revalidatePath('/applied-service-charges');
    revalidatePath('/shares');
    return newMember;
}

export async function updateMember(id: string, data: MemberInput): Promise<Member> {
    const { address, emergencyContact, shareCommitmentIds, serviceChargeIds, salary, ...memberData } = data;

    validateMemberData(data);

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
      select: { address: true, emergencyContact: true, memberShareCommitments: { select: { shareTypeId: true }} },
    });

    if (!existingMember) throw new Error("Member not found");
    
    let cleanAddressPayload: Prisma.AddressCreateWithoutMemberInput | undefined;
    if (address && Object.values(address).some(val => val !== '' && val !== null && val !== undefined)) {
        const { id: addressId, memberId, collateralId, ...restOfAddress } = address as any;
        cleanAddressPayload = restOfAddress;
    }

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
        
    const shareTypesToCommit = await prisma.shareType.findMany({
        where: { id: { in: shareCommitmentIds || [] } }
    });
    
    const existingCommitmentIds = new Set(existingMember.memberShareCommitments.map(c => c.shareTypeId));
    const newCommitmentIds = new Set(shareCommitmentIds || []);

    const commitmentsToAdd = shareTypesToCommit.filter(st => !existingCommitmentIds.has(st.id));
    const commitmentsToRemove = Array.from(existingCommitmentIds).filter(id => !newCommitmentIds.has(id));

    const updatedMember = await prisma.member.update({
        where: { id },
        data: {
            ...memberData,
            salary,
            joinDate: new Date(memberData.joinDate),
            address: addressUpdate,
            emergencyContact: emergencyContactUpdate,
            memberShareCommitments: {
                 deleteMany: {
                     shareTypeId: { in: commitmentsToRemove }
                 },
                 create: commitmentsToAdd.map(st => ({
                    shareTypeId: st.id,
                    totalCommittedAmount: st.totalAmount,
                }))
            }
        },
    });

    revalidatePath('/members');
    revalidatePath('/shares');
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

export async function transferMember(memberId: string, newSchoolId: string, reason?: string): Promise<{ success: boolean, message: string }> {
    try {
        const transferDate = new Date();
        const [member, newSchool] = await Promise.all([
            prisma.member.findUnique({ where: { id: memberId } }),
            prisma.school.findUnique({ where: { id: newSchoolId } }),
        ]);

        if (!member) return { success: false, message: 'Member not found.' };
        if (!newSchool) return { success: false, message: 'New school not found.' };

        await prisma.$transaction(async (tx) => {
            // 1. End date the current school history record
            await tx.schoolHistory.updateMany({
                where: {
                    memberId: memberId,
                    endDate: null, // Find the current active record
                },
                data: {
                    endDate: transferDate,
                }
            });

            // 2. Create the new school history record
            await tx.schoolHistory.create({
                data: {
                    memberId: memberId,
                    schoolId: newSchoolId,
                    schoolName: newSchool.name,
                    startDate: transferDate,
                    reason: reason,
                }
            });

            // 3. Update the member's current school
            await tx.member.update({
                where: { id: memberId },
                data: { schoolId: newSchoolId }
            });
        });

        revalidatePath('/members');
        revalidatePath(`/member-profile/${memberId}`);
        return { success: true, message: `Successfully transferred ${member.fullName} to ${newSchool.name}.` };
    } catch (error) {
        console.error("Failed to transfer member:", error);
        return { success: false, message: 'An unexpected error occurred during the transfer.' };
    }
}


export interface ImportedMember {
    MemberID: string;
    MemberFullName: string;
    InitialSavingsBalance: number;
    SchoolID: string;
}

export async function importMembers(members: ImportedMember[]): Promise<{ success: boolean, message: string }> {
    // Find a default savings account type, e.g., "Regular Savings"
    const defaultSavingType = await prisma.savingAccountType.findFirst({
        where: { name: { contains: 'Regular', mode: 'insensitive' } }
    });

    if (!defaultSavingType) {
        return { success: false, message: 'Could not find a default "Regular Savings" account type. Please create one before importing members.' };
    }

    const membersToCreate = members.map(m => ({
        id: m.MemberID,
        fullName: m.MemberFullName,
        email: `${m.MemberID}@academinvest.com`, // Create a placeholder email
        sex: 'Male' as 'Male' | 'Female', // Default value
        phoneNumber: '0900000000', // Default value
        schoolId: m.SchoolID,
        joinDate: new Date(),
        status: 'active' as 'active' | 'inactive',
    }));
    
    const result = await prisma.member.createMany({
        data: membersToCreate,
        skipDuplicates: true,
    });
    
    if (result.count > 0) {
        // Now create the default saving account for the newly created members
        const createdMemberIds = membersToCreate.slice(0, result.count).map(m => m.id);
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
            data: savingAccountsToCreate
        });
    }

    revalidatePath('/members');
    revalidatePath('/savings-accounts');

    const skippedCount = members.length - result.count;
    let message = `Successfully imported ${result.count} new members and created default savings accounts.`;
    if (skippedCount > 0) {
        message += ` ${skippedCount} member(s) were skipped as they already exist.`;
    }

    return { success: true, message };
}
