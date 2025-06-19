export interface School {
  id: string;
  name: string;
  address?: string;
  contactPerson?: string;
}

export interface ShareType {
  id: string;
  name: string;
  description?: string;
  valuePerShare: number;
}

export interface SavingAccountType {
  id: string;
  name: string;
  interestRate: number; // Store as decimal, e.g., 0.05 for 5%
  description?: string;
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
  sex: 'Male' | 'Female' | 'Other';
  phoneNumber: string;
  address: {
    city: string;
    subCity: string;
    wereda: string;
  };
  emergencyContact: {
    name: string;
    phone: string;
  };
  schoolId: string;
  schoolName?: string; // Denormalized for display
  joinDate: string; // ISO date string
  savingsBalance: number;
  sharesCount: number; // Total shares across all types
  shareCommitments?: MemberShareCommitment[];
  savingAccountTypeId?: string;
  savingAccountTypeName?: string; // Denormalized for display
}

export interface Saving {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  amount: number;
  date: string; // ISO date string
  month: string; // e.g., "January 2024"
  transactionType: 'deposit' | 'withdrawal';
  // Future: savingAccountTypeId?: string;
}

export interface Share {
  id: string;
  memberId: string;
  memberName?: string; // Denormalized for display
  shareTypeId: string;
  shareTypeName?: string; // Denormalized for display
  count: number;
  allocationDate: string; // ISO date string
  valuePerShare: number; // Set at the time of allocation based on ShareType
}

export interface Dividend {
  id:string;
  memberId: string;
  memberName?: string; // Denormalized for display
  amount: number;
  distributionDate: string; // ISO date string
  shareCountAtDistribution: number; // Could be refined to be per share type if dividends vary
}

export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  disabled?: boolean;
  external?: boolean;
  label?: string;
  description?: string;
  active?: boolean;
}

export type ReportType = 'savings' | 'share allocations' | 'dividend distributions';
export type VisualizationType = 'bar' | 'pie' | 'line' | 'table';

