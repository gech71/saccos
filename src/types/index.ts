

import type { Prisma } from '@prisma/client';

export interface School {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
}

export interface ShareType {
  id: string;
  name: string;
  description?: string | null;
  valuePerShare: number;
}

export interface SavingAccountType {
  id: string;
  name: string;
  interestRate: number; // Store as decimal, e.g., 0.05 for 5%
  description?: string;
  contributionType: 'FIXED' | 'PERCENTAGE';
  contributionValue: number;
}

export interface LoanType {
  id: string;
  name: string;
  interestRate: number; // Annual interest rate, e.g., 0.08 for 8%
  loanTerm: number; // in months
  repaymentFrequency: 'monthly' | 'quarterly' | 'yearly';
  nplInterestRate: number; // Non-Performing Loan interest rate, annual
  nplGracePeriodDays?: number; // Days after due date before NPL rate applies
  allowConcurrent?: boolean;
}

export interface MemberShareCommitment {
  shareTypeId: string;
  shareTypeName: string; // Denormalized for easier display
  monthlyCommittedAmount: number;
}

export interface Member {
  id: string;
  fullName: string;
  email: string;
  sex: 'Male' | 'Female';
  phoneNumber: string;
  address: Prisma.AddressGetPayload<{}> | null;
  emergencyContact: Prisma.EmergencyContactGetPayload<{}> | null;
  schoolId: string;
  schoolName?: string; // Denormalized for display
  joinDate: string; // ISO date string
  salary: number | null;
  status?: 'active' | 'inactive';
  closureDate?: string; // ISO date string
  memberSavingAccounts?: any[]; // To hold the relation
  shareCommitments?: MemberShareCommitment[];
}

export interface Saving {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  amount: number;
  date: string; // ISO date string
  month: string; // e.g., "January 2024"
  transactionType: 'deposit' | 'withdrawal';
  status: 'pending' | 'approved' | 'rejected';
  notes?: string; // For rejection reasons or other comments
  depositMode?: 'Cash' | 'Bank' | 'Wallet'; // Only applicable for deposits
  sourceName?: string;
  transactionReference?: string;
  evidenceUrl?: string;
}

export interface Share {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  shareTypeId: string;
  shareTypeName?: string; // Denormalized for display
  count: number; // Number of shares allocated
  allocationDate: string; // ISO date string
  valuePerShare: number; // Value per share at the time of allocation
  status: 'pending' | 'approved' | 'rejected';
  notes?: string; // For rejection reasons or other comments
  contributionAmount?: number; // The monetary amount input by the user for this specific allocation
  totalValueForAllocation?: number; // Actual value of shares allocated (count * valuePerShare)
  depositMode?: 'Cash' | 'Bank' | 'Wallet';
  sourceName?: string;
  transactionReference?: string;
  evidenceUrl?: string;
}

export interface Dividend {
  id:string;
  memberId: string;
  memberName?: string; // Denormalized for display
  amount: number;
  distributionDate: string; // ISO date string
  shareCountAtDistribution: number; // Could be refined to be per share type if dividends vary
  status: 'pending' | 'approved' | 'rejected';
  notes?: string; // For rejection reasons or other comments
}

export interface ServiceChargeType {
  id: string;
  name: string;
  description?: string;
  amount: number;
  frequency: 'once' | 'monthly' | 'yearly'; // Informational for now, auto-application is future scope
}

export interface AppliedServiceCharge {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  serviceChargeTypeId: string;
  serviceChargeTypeName: string; // Denormalized for display
  amountCharged: number;
  dateApplied: string; // ISO date string
  status: 'pending' | 'paid' | 'waived';
  notes?: string;
  // paymentTransactionId?: string; // Future: link to a master payment transaction
}


export interface NavItem {
  title: string;
  href?: string;
  icon?: React.ElementType;
  disabled?: boolean;
  external?: boolean;
  label?: string;
  isGroupLabel?: boolean;
  description?: string;
  active?: boolean;
  permission?: string;
}

export type ReportType = 'savings' | 'share-allocations' | 'dividend-distributions';

export interface Collateral {
  id: string;
  fullName: string;
  organization?: {
    name: string;
    address: string;
    phone: string;
  };
  address: {
    city: string;
    subCity: string;
    wereda: string;
    kebele?: string;
    houseNumber?: string;
  };
}

export interface Loan {
  id: string;
  loanAccountNumber?: string;
  memberId: string;
  memberName?: string;
  loanTypeId: string;
  loanTypeName?: string;
  principalAmount: number;
  interestRate: number; // annual rate at time of loan
  loanTerm: number; // in months
  repaymentFrequency: 'monthly' | 'quarterly' | 'yearly';
  disbursementDate: string; // ISO
  status: 'pending' | 'active' | 'paid_off' | 'rejected' | 'overdue';
  remainingBalance: number;
  nextDueDate?: string; // ISO
  notes?: string;
  monthlyRepaymentAmount?: number;
  collateral?: Collateral[];
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  memberId: string;
  memberName?: string;
  amountPaid: number;
  paymentDate: string; // ISO
  notes?: string;
  depositMode?: 'Cash' | 'Bank' | 'Wallet';
  sourceName?: string;
  transactionReference?: string;
  evidenceUrl?: string;
}

export interface AuthResponse {
  isSuccess: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string; // Add this to capture the ID on registration
  errors?: string[] | null;
}

export interface AuthUser {
  id: string; // Prisma DB ID
  userId: string; // External Auth Provider ID
  email: string;
  name: string;
  phoneNumber: string;
  roles: string[];
  permissions: string[];
}


export type MemberInput = Omit<Member, 'schoolName' | 'joinDate' | 'status' | 'closureDate' | 'shareCommitments' | 'address' | 'emergencyContact' | 'memberSavingAccounts'> & {
    joinDate: string;
    salary?: number | null;
    shareCommitments?: { shareTypeId: string; monthlyCommittedAmount: number }[];
    address?: Prisma.AddressCreateWithoutMemberInput;
    emergencyContact?: Prisma.EmergencyContactCreateWithoutMemberInput;
};
