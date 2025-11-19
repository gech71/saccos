
'use server';

import prisma from '@/lib/prisma';
import { Prisma, type SavingAccountType, type ServiceChargeType, type ShareType, type Member } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { logAudit } from '@/lib/audit-log';
import { differenceInMonths } from 'date-fns';

// Helpers for phone normalization/formatting
function toLocalPhone(phone?: string | null) {
    if (!phone) return '';
    const p = phone.trim();
    if (p.startsWith('+251')) {
        const rest = p.slice(4);
        return rest ? `0${rest}` : p;
    }
    return p;
}

function toIntlPhone(phone?: string | null) {
    if (!phone) return '';
    const p = phone.trim();
    if (p.startsWith('+251')) return p;
    if (/^0[79]\d{8}$/.test(p)) return `+251${p.slice(1)}`;
    return p;
}

// This is the shape of the data the client page will receive
export interface MemberWithDetails extends Member {
    school: { name: string } | null;
    memberSavingAccounts: ({
        savingAccountType: { name: string; };
    } & Prisma.MemberSavingAccountGetPayload<{}>)[];
    memberShareCommitments: ({
        shareType: { name: string; } | null;
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
        orderBy: { memberId: 'asc' }
    });

    const schools = await prisma.school.findMany({ select: { id: true, name: true }, orderBy: {name: 'asc'} });
    const shareTypes = await prisma.shareType.findMany({ orderBy: {name: 'asc'} });
    const savingAccountTypes = await prisma.savingAccountType.findMany({ select: { id: true, name: true, contributionType: true, contributionValue: true, interestRate: true }, orderBy: {name: 'asc'} });
    const serviceChargeTypes = await prisma.serviceChargeType.findMany({ orderBy: {name: 'asc'} });


    // Map members to a more usable format for the client
    const formattedMembers: MemberWithDetails[] = members.map(member => ({
        ...member,
        joinDate: member.joinDate, // Keep as Date object for server
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

const addressSchema = z.object({
  city: z.string().optional(),
  subCity: z.string().optional(),
  wereda: z.string().optional(),
  kebele: z.string().optional(),
  houseNumber: z.string().optional(),
}).optional();

const emergencyContactSchema = z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
}).optional();

// Zod schema for robust validation
const memberInputSchema = z.object({
    memberId: z.string().min(1, 'Member ID is required.'),
    fullName: z.string().min(2, 'Full name is required.').max(100),
    email: z.string().email('Invalid email format.').toLowerCase(),
    sex: z.enum(['Male', 'Female']),
    // Accept local formats starting with 09 or 07 plus 8 digits, or international +2519/+2517 + 8 digits
    phoneNumber: z.string().regex(/^(?:0[79]\d{8}|\+251[79]\d{8})$/, 'Phone number must be in the format 09xxxxxxxx, 07xxxxxxxx, +2519xxxxxxxx or +2517xxxxxxxx'),
    schoolId: z.string().min(1, 'School is required.'),
    joinDate: z.string().refine((date) => !isNaN(Date.parse(date)), { message: "Invalid join date" }),
    salary: z.number().nullable().optional(),
    shareCommitmentIds: z.array(z.string().nullable()).optional(),
    serviceChargeIds: z.array(z.string()).optional(),
    address: addressSchema,
    emergencyContact: emergencyContactSchema,
});


// Type for creating/updating a member, received from the client
export type MemberInput = z.infer<typeof memberInputSchema>;

// Helper function for duplicate checks
async function checkDuplicates(email: string, phoneNumber: string, memberUUID?: string) {
    const OR: any[] = [];
    if (email) OR.push({ email: { equals: email, mode: 'insensitive' as const } });
    if (phoneNumber) {
        const local = toLocalPhone(phoneNumber);
        const intl = toIntlPhone(phoneNumber);
        OR.push({ phoneNumber: local });
        OR.push({ phoneNumber: intl });
    }

    const where: Prisma.MemberWhereInput = { OR };
    if (memberUUID) {
        where.NOT = { id: memberUUID };
    }

    const existingMember = await prisma.member.findFirst({ where });
    if (existingMember) {
        if (existingMember.email?.toLowerCase() === email.toLowerCase()) return `Email is already in use by member ${existingMember.fullName}.`;
        const storedLocal = toLocalPhone(existingMember.phoneNumber);
        const inputLocal = toLocalPhone(phoneNumber);
        if (storedLocal === inputLocal) return `Phone number is already in use by member ${existingMember.fullName}.`;
    }
    
    // Also check against admin users
    const userWhere: Prisma.UserWhereInput = { OR: [] };
    if (email) (userWhere.OR as any).push({ email: { equals: email, mode: 'insensitive' as const } });
    if (phoneNumber) {
        const local = toLocalPhone(phoneNumber);
        const intl = toIntlPhone(phoneNumber);
        (userWhere.OR as any).push({ phoneNumber: local });
        (userWhere.OR as any).push({ phoneNumber: intl });
    }
    
    const existingUser = await prisma.user.findFirst({ where: userWhere });
    if (existingUser) {
        if (existingUser.email?.toLowerCase() === email.toLowerCase()) return `Email is already in use by an admin user.`;
        const storedLocal = toLocalPhone(existingUser.phoneNumber);
        const inputLocal = toLocalPhone(phoneNumber);
        if (storedLocal === inputLocal) return `Phone number is already in use by an admin user.`;
    }
    
    return null;
}


export async function addMember(data: MemberInput): Promise<{ member?: Member; error?: string; temporaryPassword?: string }> {
    const validationResult = memberInputSchema.safeParse(data);
    if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        return { error: `${firstError.path.join('.')}: ${firstError.message}` };
    }

    try {
    const { memberId, address, emergencyContact, shareCommitmentIds, serviceChargeIds, ...memberData } = validationResult.data;
    if (memberData.phoneNumber) memberData.phoneNumber = toLocalPhone(memberData.phoneNumber as string);

        const existingMemberBySeqId = await prisma.member.findUnique({ where: { memberId: memberId } });
        if (existingMemberBySeqId) {
            return { error: `Member ID '${memberId}' already exists.` };
        }

        const duplicateError = await checkDuplicates(memberData.email, memberData.phoneNumber);
        if (duplicateError) {
            return { error: duplicateError };
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

        const validShareCommitmentIds = (shareCommitmentIds || []).filter((id): id is string => !!id);
        const shareTypesToCommit = await prisma.shareType.findMany({
            where: { id: { in: validShareCommitmentIds } }
        });

        const temporaryPassword = randomBytes(12).toString('hex');
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        const newMember = await prisma.member.create({
            data: {
                memberId,
                ...memberData,
                password: hashedPassword,
                temporaryPassword: temporaryPassword,
                mustChangePassword: true,
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

        await logAudit('MEMBER_CREATE', {
            targetId: newMember.id,
            targetType: 'MEMBER',
            details: { name: newMember.fullName, memberId: newMember.memberId }
        });

        revalidatePath('/members');
        revalidatePath('/applied-service-charges');
        revalidatePath('/shares');
        return { member: newMember, temporaryPassword };
    } catch (error) {
        console.error('Failed to add member:', error);
        return { error: 'An unexpected server error occurred. Please check the logs.' };
    }
}

export async function updateMember(id: string, data: MemberInput): Promise<{ success: boolean; error?: string }> {
    const validationResult = memberInputSchema.safeParse(data);
    if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        return { success: false, error: `${firstError.path.join('.')}: ${firstError.message}` };
    }

    try {
    const { address, emergencyContact, shareCommitmentIds, serviceChargeIds, salary, ...memberData } = validationResult.data;
    if (memberData.phoneNumber) memberData.phoneNumber = toLocalPhone(memberData.phoneNumber as string);

    const duplicateError = await checkDuplicates(memberData.email, memberData.phoneNumber, id);
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }
        
        const existingMember = await prisma.member.findUnique({
          where: { id },
          select: { address: true, emergencyContact: true, memberShareCommitments: { select: { shareTypeId: true }} },
        });

        if (!existingMember) {
             return { success: false, error: "Member not found." };
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

        const addressUpdate = cleanAddressPayload
            ? { upsert: { create: cleanAddressPayload, update: cleanAddressPayload } }
            : (existingMember?.address ? { delete: true } : undefined);

        const emergencyContactUpdate = cleanEmergencyContactPayload
            ? { upsert: { create: cleanEmergencyContactPayload, update: cleanEmergencyContactPayload } }
            : (existingMember?.emergencyContact ? { delete: true } : undefined);
            
        const validShareCommitmentIds = (shareCommitmentIds || []).filter((id): id is string => !!id);
        
        const shareTypesToCommit = await prisma.shareType.findMany({
            where: { id: { in: validShareCommitmentIds } }
        });
        
        const existingCommitmentIds = new Set(existingMember.memberShareCommitments.map(c => c.shareTypeId).filter((id): id is string => !!id));
        const newCommitmentIds = new Set(validShareCommitmentIds);

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

        await logAudit('MEMBER_UPDATE', {
            targetId: updatedMember.id,
            targetType: 'MEMBER',
            details: { changes: Object.keys(data) }
        });

        revalidatePath('/members');
        revalidatePath('/shares');
        return { success: true };
    } catch (error) {
        console.error('Failed to update member:', error);
        return { success: false, error: 'An unexpected error occurred during update.' };
    }
}


export async function deleteMember(id: string): Promise<{ success: boolean; message: string }> {
    try {
        const member = await prisma.member.findUnique({ where: { id } });
        if (!member) {
            return { success: false, message: 'Member not found.' };
        }

        const loanCount = await prisma.loan.count({ where: { memberId: id, status: { in: ['active', 'overdue'] } } });
        if (loanCount > 0) {
            return { success: false, message: 'Cannot delete member with active or overdue loans. Please resolve loans first.' };
        }

        await prisma.member.delete({
            where: { id },
        });

        await logAudit('MEMBER_DELETE', {
            targetId: member.id,
            targetType: 'MEMBER',
            details: { name: member.fullName, memberId: member.memberId }
        });

        revalidatePath('/members');
        return { success: true, message: 'Member deleted successfully.' };
    } catch (error) {
        console.error("Failed to delete member:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return { success: false, message: 'Failed to delete member. They may have related records (like historical share payments or school history) that could not be deleted.' };
        }
        return { success: false, message: 'An unexpected error occurred while deleting the member.' };
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
            await tx.schoolHistory.updateMany({
                where: {
                    memberId: memberId,
                    endDate: null,
                },
                data: {
                    endDate: transferDate,
                }
            });
            await tx.schoolHistory.create({
                data: {
                    memberId: memberId,
                    schoolId: newSchoolId,
                    schoolName: newSchool.name,
                    startDate: transferDate,
                    reason: reason,
                }
            });
            await tx.member.update({
                where: { id: memberId },
                data: { schoolId: newSchoolId }
            });
        });

        await logAudit('MEMBER_TRANSFER', {
            targetId: memberId,
            targetType: 'MEMBER',
            details: { toSchoolId: newSchoolId, toSchoolName: newSchool.name, reason }
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
  MemberID: string | number;
  MemberFullName: string;
  PhoneNumber: string;
  SchoolID: string;
  Salary?: number;
}

export interface CreatedMemberInfo {
    member: Member;
    temporaryPassword?: string;
}

export async function importMembers(
  members: ImportedMember[]
): Promise<{ success: boolean; message: string; createdMembers?: CreatedMemberInfo[] }> {
  if (members.length === 0) {
    return { success: true, message: 'No new members to import.' };
  }

  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  const schoolMap = new Map(schools.map((s) => [s.id, s.name]));
  const joinDate = new Date();
  
  let createdCount = 0;
  let skippedCount = 0;
  const createdMembersInfo: CreatedMemberInfo[] = [];

  for (const m of members) {
    const memberId = String(m.MemberID).trim();
    
    try {
      const temporaryPassword = randomBytes(12).toString('hex');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
      
      const newMember = await prisma.member.create({
        data: {
          memberId: memberId,
          fullName: m.MemberFullName,
          email: `${randomBytes(8).toString('hex')}@academinvest.com`, // Generate unique email
          password: hashedPassword,
          temporaryPassword,
          mustChangePassword: true,
          sex: 'Male', // Default, can be updated later
          phoneNumber: toLocalPhone(m.PhoneNumber),
          schoolId: m.SchoolID,
          joinDate,
          status: 'active',
          salary: m.Salary,
        }
      });
      
      await prisma.schoolHistory.create({
          data: {
            memberId: newMember.id,
            schoolId: newMember.schoolId,
            schoolName: schoolMap.get(newMember.schoolId) || 'Unknown School',
            startDate: joinDate,
            endDate: null,
          }
      });
      
      await logAudit('MEMBER_CREATE', {
        targetId: newMember.id,
        targetType: 'MEMBER',
        details: { name: newMember.fullName, memberId: newMember.memberId, source: 'bulk-import' }
      });

      createdMembersInfo.push({ member: newMember, temporaryPassword });
      createdCount++;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        skippedCount++;
      } else {
        console.error(`Failed to import member ${memberId}:`, error);
        return { success: false, message: `An error occurred while importing member ${memberId}. Please check the logs.` };
      }
    }
  }

  revalidatePath('/members');

  let message = `Successfully imported ${createdCount} new members.`;
  if (skippedCount > 0) {
    message += ` ${skippedCount} member(s) were skipped as duplicates.`;
  }

  return { success: true, message, createdMembers: createdMembersInfo };
}
