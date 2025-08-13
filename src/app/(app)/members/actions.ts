
'use server';

import prisma from '@/lib/prisma';
import type { Prisma, SavingAccountType, ServiceChargeType, ShareType } from '@prisma/client';
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
